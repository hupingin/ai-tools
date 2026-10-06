'use strict';

const fsp = require('node:fs/promises');
const png = require('../../lib/png');
const { inputError, usageError } = require('../../lib/errors');
const { fmt } = require('../../lib/num');

/**
 * 输入契约：
 *   input.desc 可以是 PNG 二进制本体，也可以是"第 1 行为图片路径"的文本。
 * 输出契约：
 *   图像处理类函数把 PNG 二进制写入 output.desc；统计类函数写文本。
 */

async function loadImage(ctx) {
  if (png.isPng(ctx.buf)) return png.decode(ctx.buf);
  const lines = ctx.desc.lines();
  if (!lines.length) {
    throw inputError('input.desc 既不是 PNG 二进制，也没有给出图片路径',
      '把 PNG 拷成 input.desc，或让 input.desc 第 1 行为图片路径');
  }
  const p = lines[0];
  let buf;
  try {
    buf = await fsp.readFile(p);
  } catch (e) {
    throw inputError(`无法读取图片: ${p}`);
  }
  return png.decode(buf);
}

function blank(w, h) {
  return { width: w, height: h, channels: 4, pixels: Buffer.alloc(w * h * 4) };
}

function mapPixels(img, fn) {
  const out = blank(img.width, img.height);
  for (let i = 0; i < img.pixels.length; i += 4) {
    const [r, g, b, a] = fn(img.pixels[i], img.pixels[i + 1], img.pixels[i + 2], img.pixels[i + 3], i / 4);
    out.pixels[i] = clamp(r);
    out.pixels[i + 1] = clamp(g);
    out.pixels[i + 2] = clamp(b);
    out.pixels[i + 3] = a === undefined ? 255 : clamp(a);
  }
  return out;
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/** 双线性缩放 */
function resize(img, w, h) {
  const out = blank(w, h);
  const xr = img.width / w, yr = img.height / h;
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.max(0, (y + 0.5) * yr - 0.5));
    const y0 = Math.floor(sy), y1 = Math.min(img.height - 1, y0 + 1), fy = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.max(0, (x + 0.5) * xr - 0.5));
      const x0 = Math.floor(sx), x1 = Math.min(img.width - 1, x0 + 1), fx = sx - x0;
      const i00 = (y0 * img.width + x0) * 4;
      const i10 = (y0 * img.width + x1) * 4;
      const i01 = (y1 * img.width + x0) * 4;
      const i11 = (y1 * img.width + x1) * 4;
      const d = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        const a = img.pixels[i00 + c], b = img.pixels[i10 + c];
        const e = img.pixels[i01 + c], f = img.pixels[i11 + c];
        out.pixels[d + c] = clamp(a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + e * (1 - fx) * fy + f * fx * fy);
      }
    }
  }
  return out;
}

/** 分离式盒式模糊（近似高斯，O(n)） */
function boxBlur(img, radius) {
  const r = Math.max(0, Math.floor(radius));
  if (r === 0) return img;
  const w = img.width, h = img.height;
  const tmp = blank(w, h);
  const out = blank(w, h);
  const win = r * 2 + 1;
  // 水平
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += img.pixels[(y * w + Math.min(w - 1, Math.max(0, x))) * 4 + c];
      for (let x = 0; x < w; x++) {
        tmp.pixels[(y * w + x) * 4 + c] = sum / win;
        const add = img.pixels[(y * w + Math.min(w - 1, x + r + 1)) * 4 + c];
        const sub = img.pixels[(y * w + Math.max(0, x - r)) * 4 + c];
        sum += add - sub;
      }
    }
  }
  // 垂直
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp.pixels[(Math.min(h - 1, Math.max(0, y)) * w + x) * 4 + c];
      for (let y = 0; y < h; y++) {
        out.pixels[(y * w + x) * 4 + c] = sum / win;
        const add = tmp.pixels[(Math.min(h - 1, y + r + 1) * w + x) * 4 + c];
        const sub = tmp.pixels[(Math.max(0, y - r) * w + x) * 4 + c];
        sum += add - sub;
      }
    }
  }
  return out;
}

/** 通用 3x3 卷积（对 RGB，Alpha 保持） */
function convolve3(img, k, scale = 1, offset = 0) {
  const w = img.width, h = img.height;
  const out = blank(w, h);
  const at = (x, y, c) => img.pixels[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4 + c];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            s += at(x + kx, y + ky, c) * k[(ky + 1) * 3 + (kx + 1)];
          }
        }
        out.pixels[d + c] = clamp(s / scale + offset);
      }
      out.pixels[d + 3] = img.pixels[d + 3];
    }
  }
  return out;
}

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function mk(name, group, summary, o) {
  return {
    name, group, summary,
    args: o.args || [],
    input: { kind: 'text', binary: true, layout: 'png-or-path', desc: o.inDesc || 'PNG 二进制，或第 1 行为图片路径', example: o.inExample },
    output: { layout: o.outLayout || 'png(binary)', desc: o.outDesc || 'PNG 二进制', example: o.outExample },
    examples: [],
    run: o.run,
  };
}

const functions = [
  /* ---------- 信息 ---------- */
  mk('info', '信息', '输出图像基本信息', {
    outLayout: 'kv', outDesc: '每行一项：键 值',
    run: async (ctx) => {
      const img = await loadImage(ctx);
      return [
        `width ${img.width}`,
        `height ${img.height}`,
        `channels ${img.channels}`,
        `pixels ${img.width * img.height}`,
        `source_color_type ${img.colorType}`,
        `bit_depth ${img.bitDepth}`,
      ].join('\n');
    },
  }),
  mk('stats', '信息', '输出平均色与亮度统计', {
    outLayout: 'kv', outDesc: '每行一项：键 值',
    run: async (ctx) => {
      const img = await loadImage(ctx);
      let sr = 0, sg = 0, sb = 0, sa = 0;
      let minL = 255, maxL = 0;
      const n = img.width * img.height;
      for (let i = 0; i < img.pixels.length; i += 4) {
        const r = img.pixels[i], g = img.pixels[i + 1], b = img.pixels[i + 2], a = img.pixels[i + 3];
        sr += r; sg += g; sb += b; sa += a;
        const l = luma(r, g, b);
        if (l < minL) minL = l;
        if (l > maxL) maxL = l;
      }
      return [
        `mean_r ${fmt(sr / n)}`, `mean_g ${fmt(sg / n)}`, `mean_b ${fmt(sb / n)}`,
        `mean_a ${fmt(sa / n)}`, `min_luma ${fmt(minL)}`, `max_luma ${fmt(maxL)}`,
      ].join('\n');
    },
  }),
  mk('histogram', '信息', '灰度直方图，--bins 桶数（默认 16）', {
    args: [{ short: '-b', long: '--bins', type: 'number', default: 16, desc: '桶数' }],
    outLayout: 'rows', outDesc: '每行 "下界 上界 像素数"',
    run: async (ctx) => {
      const img = await loadImage(ctx);
      const bins = Math.max(1, Math.floor(ctx.opts.bins || 16));
      const cnt = new Array(bins).fill(0);
      for (let i = 0; i < img.pixels.length; i += 4) {
        const l = luma(img.pixels[i], img.pixels[i + 1], img.pixels[i + 2]);
        let k = Math.floor((l / 256) * bins);
        if (k >= bins) k = bins - 1;
        cnt[k]++;
      }
      const step = 256 / bins;
      return cnt.map((c, i) => `${fmt(i * step)} ${fmt((i + 1) * step)} ${c}`).join('\n');
    },
  }),

  /* ---------- 几何 ---------- */
  mk('resize', '几何', '缩放，--width/--height 给一个则按比例自适应', {
    args: [{ short: '-w', long: '--width', type: 'number', desc: '目标宽' }, { short: '-H', long: '--height', type: 'number', desc: '目标高' }],
    run: async (ctx) => {
      const img = await loadImage(ctx);
      let w = ctx.opts.width, h = ctx.opts.height;
      if (!w && !h) throw usageError('需要 --width 或 --height');
      if (!w) w = Math.max(1, Math.round(img.width * (h / img.height)));
      if (!h) h = Math.max(1, Math.round(img.height * (w / img.width)));
      return png.encode(resize(img, Math.max(1, Math.round(w)), Math.max(1, Math.round(h))));
    },
  }),
  mk('thumbnail', '几何', '生成 --size × --size 内的缩略图（保持比例，透明填充）', {
    args: [{ short: '-s', long: '--size', type: 'number', default: 128, desc: '最大边长' }],
    run: async (ctx) => {
      const img = await loadImage(ctx);
      const s = Math.max(1, Math.round(ctx.opts.size || 128));
      const k = Math.min(s / img.width, s / img.height);
      const w = Math.max(1, Math.round(img.width * k));
      const h = Math.max(1, Math.round(img.height * k));
      const small = resize(img, w, h);
      const out = blank(s, s);
      const ox = Math.floor((s - w) / 2), oy = Math.floor((s - h) / 2);
      for (let y = 0; y < h; y++) {
        small.pixels.copy(out.pixels, ((oy + y) * s + ox) * 4, y * w * 4, (y + 1) * w * 4);
      }
      return png.encode(out);
    },
  }),
  mk('crop', '几何', '裁剪，--x --y --w --h', {
    args: [
      { long: '--x', type: 'number', default: 0, desc: '起点 X' },
      { long: '--y', type: 'number', default: 0, desc: '起点 Y' },
      { long: '--w', type: 'number', desc: '宽度（必填）' },
      { long: '--h', type: 'number', desc: '高度（必填）' },
    ],
    run: async (ctx) => {
      const img = await loadImage(ctx);
      const w = Math.round(ctx.opts.w || 0), h = Math.round(ctx.opts.h || 0);
      if (w <= 0 || h <= 0) throw usageError('需要 --w 与 --h');
      const x = Math.round(ctx.opts.x || 0), y = Math.round(ctx.opts.y || 0);
      if (x + w > img.width || y + h > img.height) throw inputError(`裁剪区域超出图像范围 (${img.width}x${img.height})`);
      const out = blank(w, h);
      for (let row = 0; row < h; row++) {
        img.pixels.copy(out.pixels, row * w * 4, ((y + row) * img.width + x) * 4, ((y + row) * img.width + x + w) * 4);
      }
      return png.encode(out);
    },
  }),
  mk('rotate', '几何', '旋转 --angle 度（90/180/270，逆时针为正）', {
    args: [{ short: '-a', long: '--angle', type: 'number', default: 90, desc: '90|180|270|-90' }],
    run: async (ctx) => {
      const img = await loadImage(ctx);
      let a = ((Math.round(ctx.opts.angle || 90) % 360) + 360) % 360;
      if (a !== 90 && a !== 180 && a !== 270) throw inputError('只支持 90/180/270 度旋转');
      let out;
      if (a === 180) {
        out = blank(img.width, img.height);
        for (let i = 0, n = img.width * img.height; i < n; i++) {
          const s = i * 4, d = (n - 1 - i) * 4;
          for (let c = 0; c < 4; c++) out.pixels[d + c] = img.pixels[s + c];
        }
      } else if (a === 90) {
        out = blank(img.height, img.width);
        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            const s = (y * img.width + x) * 4;
            const d = ((img.width - 1 - x) * img.height + y) * 4;
            for (let c = 0; c < 4; c++) out.pixels[d + c] = img.pixels[s + c];
          }
        }
      } else {
        out = blank(img.height, img.width);
        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            const s = (y * img.width + x) * 4;
            const d = (x * img.height + (img.height - 1 - y)) * 4;
            for (let c = 0; c < 4; c++) out.pixels[d + c] = img.pixels[s + c];
          }
        }
      }
      return png.encode(out);
    },
  }),
  mk('flip', '几何', '镜像翻转，--dir h(水平)|v(垂直)', {
    args: [{ long: '--dir', default: 'h', desc: 'h|v' }],
    run: async (ctx) => {
      const img = await loadImage(ctx);
      const v = String(ctx.opts.dir || 'h').toLowerCase() === 'v';
      const out = blank(img.width, img.height);
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const s = (y * img.width + x) * 4;
          const d = (v ? (img.height - 1 - y) * img.width + x : y * img.width + (img.width - 1 - x)) * 4;
          for (let c = 0; c < 4; c++) out.pixels[d + c] = img.pixels[s + c];
        }
      }
      return png.encode(out);
    },
  }),

  /* ---------- 颜色 ---------- */
  mk('grayscale', '颜色', '转灰度（感知亮度加权）', {
    run: async (ctx) => {
      const img = await loadImage(ctx);
      return png.encode(mapPixels(img, (r, g, b, a) => {
        const y = luma(r, g, b);
        return [y, y, y, a];
      }));
    },
  }),
  mk('invert', '颜色', '反色', {
    run: async (ctx) => {
      const img = await loadImage(ctx);
      return png.encode(mapPixels(img, (r, g, b, a) => [255 - r, 255 - g, 255 - b, a]));
    },
  }),
  mk('brightness', '颜色', '调整亮度，--amount 为 -255~255 的增量', {
    args: [{ short: '-a', long: '--amount', type: 'number', default: 30, desc: '亮度增量' }],
    run: async (ctx) => {
      const img = await loadImage(ctx);
      const d = ctx.opts.amount || 0;
      return png.encode(mapPixels(img, (r, g, b, a) => [r + d, g + d, b + d, a]));
    },
  }),
  mk('contrast', '颜色', '调整对比度，--amount 为系数（1 为不变）', {
    args: [{ short: '-a', long: '--amount', type: 'number', default: 1.5, desc: '对比度系数' }],
    run: async (ctx) => {
      const img = await loadImage(ctx);
      const f = ctx.opts.amount === undefined ? 1.5 : ctx.opts.amount;
      return png.encode(mapPixels(img, (r, g, b, a) => [
        (r - 128) * f + 128, (g - 128) * f + 128, (b - 128) * f + 128, a,
      ]));
    },
  }),
  mk('saturate', '颜色', '调整饱和度，--amount 为系数（0 为去色）', {
    args: [{ short: '-a', long: '--amount', type: 'number', default: 1.5, desc: '饱和度系数' }],
    run: async (ctx) => {
      const img = await loadImage(ctx);
      const f = ctx.opts.amount === undefined ? 1.5 : ctx.opts.amount;
      return png.encode(mapPixels(img, (r, g, b, a) => {
        const y = luma(r, g, b);
        return [y + (r - y) * f, y + (g - y) * f, y + (b - y) * f, a];
      }));
    },
  }),
  mk('sepia', '颜色', '复古棕褐色调', {
    run: async (ctx) => {
      const img = await loadImage(ctx);
      return png.encode(mapPixels(img, (r, g, b, a) => [
        r * 0.393 + g * 0.769 + b * 0.189,
        r * 0.349 + g * 0.686 + b * 0.168,
        r * 0.272 + g * 0.534 + b * 0.131,
        a,
      ]));
    },
  }),
  mk('threshold', '颜色', '二值化，--level 阈值 0~255', {
    args: [{ short: '-l', long: '--level', type: 'number', default: 128, desc: '阈值' }],
    run: async (ctx) => {
      const img = await loadImage(ctx);
      const lv = ctx.opts.level === undefined ? 128 : ctx.opts.level;
      return png.encode(mapPixels(img, (r, g, b, a) => {
        const v = luma(r, g, b) >= lv ? 255 : 0;
        return [v, v, v, a];
      }));
    },
  }),

  /* ---------- 滤镜 ---------- */
  mk('blur', '滤镜', '盒式模糊，--radius 半径', {
    args: [{ short: '-r', long: '--radius', type: 'number', default: 2, desc: '半径（像素）' }],
    run: async (ctx) => {
      const img = await loadImage(ctx);
      return png.encode(boxBlur(img, ctx.opts.radius === undefined ? 2 : ctx.opts.radius));
    },
  }),
  mk('sharpen', '滤镜', '锐化（3x3 卷积）', {
    run: async (ctx) => {
      const img = await loadImage(ctx);
      return png.encode(convolve3(img, [0, -1, 0, -1, 5, -1, 0, -1, 0], 1, 0));
    },
  }),
  mk('edge', '滤镜', 'Sobel 边缘检测', {
    run: async (ctx) => {
      const img = await loadImage(ctx);
      const gray = mapPixels(img, (r, g, b, a) => { const y = luma(r, g, b); return [y, y, y, a]; });
      const gx = convolve3(gray, [-1, 0, 1, -2, 0, 2, -1, 0, 1], 1, 0);
      const gy = convolve3(gray, [-1, -2, -1, 0, 0, 0, 1, 2, 1], 1, 0);
      return png.encode(mapPixels(gx, (r, g, b, a, i) => {
        const v = Math.min(255, Math.sqrt(r * r + gy.pixels[i * 4] * gy.pixels[i * 4]));
        return [v, v, v, a];
      }));
    },
  }),
  mk('emboss', '滤镜', '浮雕效果', {
    run: async (ctx) => {
      const img = await loadImage(ctx);
      return png.encode(convolve3(img, [-2, -1, 0, -1, 1, 1, 0, 1, 2], 1, 128));
    },
  }),

  /* ---------- 比较 ---------- */
  mk('diff', '比较', '比较两张图：input 两行分别为图片路径，输出差异统计', {
    inDesc: '两行，每行一张图片的路径',
    outLayout: 'kv', outDesc: '每行一项：差异像素数、占比、平均通道差',
    run: async (ctx) => {
      const lines = ctx.desc.lines();
      if (lines.length < 2) throw inputError('需要两行：两张图片的路径');
      const read = async (p) => png.decode(await fsp.readFile(p));
      const a = await read(lines[0]);
      const b = await read(lines[1]);
      if (a.width !== b.width || a.height !== b.height) {
        throw inputError(`两张图尺寸不一致: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
      }
      let diff = 0, sum = 0;
      const n = a.width * a.height;
      for (let i = 0; i < a.pixels.length; i += 4) {
        let d = 0;
        for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(a.pixels[i + c] - b.pixels[i + c]));
        sum += d;
        if (d > 0) diff++;
      }
      return [`diff_pixels ${diff}`, `diff_ratio ${fmt(diff / n)}`, `mean_delta ${fmt(sum / n)}`].join('\n');
    },
  }),
  mk('to_text', '比较', '把图像转为字符画，--cols 字符列数', {
    args: [{ short: '-c', long: '--cols', type: 'number', default: 80, desc: '字符列数' }],
    outLayout: 'text', outDesc: 'ASCII 字符画',
    run: async (ctx) => {
      const img = await loadImage(ctx);
      const cols = Math.max(1, Math.round(ctx.opts.cols || 80));
      const rows = Math.max(1, Math.round((img.height / img.width) * cols * 0.5));
      const small = resize(img, cols, rows);
      const ramp = ' .:-=+*#%@';
      let out = '';
      for (let y = 0; y < rows; y++) {
        let line = '';
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const l = luma(small.pixels[i], small.pixels[i + 1], small.pixels[i + 2]);
          line += ramp[Math.min(ramp.length - 1, Math.floor((l / 256) * ramp.length))];
        }
        out += line.replace(/\s+$/, '') + '\n';
      }
      return out;
    },
  }),
];

module.exports = {
  name: 'image_tool',
  title: '图像处理工具',
  category: '设计 / 视觉',
  summary: '零依赖 PNG 编解码：信息统计、缩放裁剪旋转、色彩调整、模糊锐化边缘、图像比较与字符画',
  version: require('../../package.json').version,
  functions,
};
