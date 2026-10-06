'use strict';

const { inputError } = require('../../lib/errors');
const { fmt } = require('../../lib/num');

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const p2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');

/** 解析 #rgb / #rrggbb / #rrggbbaa / "r g b" / "h s l"? 仅前两类 + rgb 三元组 */
function parseColor(s) {
  const raw = String(s).trim();
  if (!raw) throw inputError('颜色为空');
  let m = raw.match(/^#?([0-9a-f]{3})$/i);
  if (m) {
    const [r, g, b] = m[1].split('').map((c) => parseInt(c + c, 16));
    return { r, g, b };
  }
  m = raw.match(/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) {
    return {
      r: parseInt(m[1].slice(0, 2), 16),
      g: parseInt(m[1].slice(2, 4), 16),
      b: parseInt(m[1].slice(4, 6), 16),
    };
  }
  const nums = raw.split(/[\s,]+/).filter(Boolean).map(Number);
  if (nums.length >= 3 && nums.slice(0, 3).every(Number.isFinite)) {
    return { r: clamp(nums[0], 0, 255), g: clamp(nums[1], 0, 255), b: clamp(nums[2], 0, 255) };
  }
  throw inputError(`无法解析颜色: ${JSON.stringify(s)}`, '支持 #ff0000、ff0000、#f00 或 "255 0 0"');
}

const toHex = (c) => `#${p2(c.r)}${p2(c.g)}${p2(c.b)}`;

function rgbToHsl({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === R) h = 60 * (((G - B) / d) % 6);
  else if (max === G) h = 60 * ((B - R) / d + 2);
  else h = 60 * ((R - G) / d + 4);
  return { h: (h + 360) % 360, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }) {
  const S = clamp(s, 0, 100) / 100;
  const L = clamp(l, 0, 100) / 100;
  const H = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = L - c / 2;
  let rgb;
  if (H < 60) rgb = [c, x, 0];
  else if (H < 120) rgb = [x, c, 0];
  else if (H < 180) rgb = [0, c, x];
  else if (H < 240) rgb = [0, x, c];
  else if (H < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return { r: (rgb[0] + m) * 255, g: (rgb[1] + m) * 255, b: (rgb[2] + m) * 255 };
}

function rgbToHsv({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === R) h = 60 * (((G - B) / d) % 6);
    else if (max === G) h = 60 * ((B - R) / d + 2);
    else h = 60 * ((R - G) / d + 4);
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}

function hsvToRgb({ h, s, v }) {
  const S = clamp(s, 0, 100) / 100;
  const V = clamp(v, 0, 100) / 100;
  const H = ((h % 360) + 360) % 360;
  const c = V * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = V - c;
  let rgb;
  if (H < 60) rgb = [c, x, 0];
  else if (H < 120) rgb = [x, c, 0];
  else if (H < 180) rgb = [0, c, x];
  else if (H < 240) rgb = [0, x, c];
  else if (H < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return { r: (rgb[0] + m) * 255, g: (rgb[1] + m) * 255, b: (rgb[2] + m) * 255 };
}

/** WCAG 相对亮度 */
function luminance({ r, g, b }) {
  const ch = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const C = (ctx) => parseColor(ctx.desc.payload());
const CS = (ctx, n) => {
  const t = ctx.desc.tokens();
  if (t.length < n) throw inputError(`需要 ${n} 个颜色`);
  return Array.from({ length: n }, (_, i) => parseColor(t[i]));
};

function mk(name, group, summary, o) {
  return {
    name, group, summary,
    args: o.args || [],
    input: { kind: 'text', layout: o.inLayout || 'text', desc: o.inDesc || '颜色值', example: o.inExample },
    output: { layout: o.outLayout || 'text', desc: o.outDesc || '', example: o.outExample },
    examples: o.outExample !== undefined
      ? [{ input: String(o.inExample ?? ''), opts: o.exOpts, expect: String(o.outExample) }] : [],
    run: o.run,
  };
}

const PCT = { short: '-a', long: '--amount', type: 'number', default: 10, desc: '调整幅度（百分点）' };

const functions = [
  /* ---------- 转换 ---------- */
  mk('parse', '转换', '把任意颜色写法归一化为 #rrggbb', {
    inExample: '#f00', outExample: '#ff0000', run: (ctx) => toHex(C(ctx)),
  }),
  mk('hex_to_rgb', '转换', '十六进制转 RGB，输出 "r g b"', {
    inExample: '#ff0000', outExample: '255 0 0', outLayout: 'values',
    run: (ctx) => { const c = C(ctx); return `${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)}`; },
  }),
  mk('rgb_to_hex', '转换', 'RGB 转十六进制', {
    inDesc: '三个数字 r g b', inExample: '255 0 0', outExample: '#ff0000',
    run: (ctx) => {
      const n = ctx.desc.numbers({ count: 3 });
      return toHex({ r: n[0], g: n[1], b: n[2] });
    },
  }),
  mk('hex_to_hsl', '转换', '转 HSL，输出 "h s% l%"', {
    inExample: '#ff0000', outExample: '0 100 50', outLayout: 'values',
    run: (ctx) => { const c = rgbToHsl(C(ctx)); return `${fmt(c.h)} ${fmt(c.s)} ${fmt(c.l)}`; },
  }),
  mk('hsl_to_hex', '转换', 'HSL 转十六进制', {
    inDesc: '三个数字：色相 0~360、饱和度%、亮度%', inExample: '0 100 50', outExample: '#ff0000',
    run: (ctx) => {
      const n = ctx.desc.numbers({ count: 3 });
      return toHex(hslToRgb({ h: n[0], s: n[1], l: n[2] }));
    },
  }),
  mk('hex_to_hsv', '转换', '转 HSV，输出 "h s% v%"', {
    inExample: '#ff0000', outExample: '0 100 100', outLayout: 'values',
    run: (ctx) => { const c = rgbToHsv(C(ctx)); return `${fmt(c.h)} ${fmt(c.s)} ${fmt(c.v)}`; },
  }),
  mk('hsv_to_hex', '转换', 'HSV 转十六进制', {
    inDesc: '三个数字：色相 0~360、饱和度%、明度%', inExample: '0 100 100', outExample: '#ff0000',
    run: (ctx) => {
      const n = ctx.desc.numbers({ count: 3 });
      return toHex(hsvToRgb({ h: n[0], s: n[1], v: n[2] }));
    },
  }),
  mk('hex_to_cmyk', '转换', '转 CMYK，输出 "c% m% y% k%"', {
    inExample: '#ff0000', outExample: '0 100 100 0', outLayout: 'values',
    run: (ctx) => {
      const { r, g, b } = C(ctx);
      const R = r / 255, G = g / 255, B = b / 255;
      const k = 1 - Math.max(R, G, B);
      if (k === 1) return '0 0 0 100';
      const c = (1 - R - k) / (1 - k), m = (1 - G - k) / (1 - k), y = (1 - B - k) / (1 - k);
      return `${fmt(c * 100)} ${fmt(m * 100)} ${fmt(y * 100)} ${fmt(k * 100)}`;
    },
  }),

  /* ---------- 调整 ---------- */
  mk('lighten', '调整', '提高亮度，--amount 百分点', {
    args: [PCT], inExample: '#808080', outExample: '#8d8d8d', exOpts: { amount: 5 },
    run: (ctx) => {
      const h = rgbToHsl(C(ctx));
      return toHex(hslToRgb({ h: h.h, s: h.s, l: clamp(h.l + (ctx.opts.amount || 10), 0, 100) }));
    },
  }),
  mk('darken', '调整', '降低亮度，--amount 百分点', {
    args: [PCT], inExample: '#808080', outExample: '#787878', exOpts: { amount: 3 },
    run: (ctx) => {
      const h = rgbToHsl(C(ctx));
      return toHex(hslToRgb({ h: h.h, s: h.s, l: clamp(h.l - (ctx.opts.amount || 10), 0, 100) }));
    },
  }),
  mk('saturate', '调整', '提高饱和度，--amount 百分点', {
    args: [PCT], inExample: '#808080', outExample: '#c04141', exOpts: { amount: 50 },
    run: (ctx) => {
      const h = rgbToHsl(C(ctx));
      return toHex(hslToRgb({ h: h.h, s: clamp(h.s + (ctx.opts.amount || 10), 0, 100), l: h.l }));
    },
  }),
  mk('desaturate', '调整', '降低饱和度，--amount 百分点', {
    args: [PCT], inExample: '#ff0000', outExample: '#bf4040', exOpts: { amount: 50 },
    run: (ctx) => {
      const h = rgbToHsl(C(ctx));
      return toHex(hslToRgb({ h: h.h, s: clamp(h.s - (ctx.opts.amount || 10), 0, 100), l: h.l }));
    },
  }),
  mk('complement', '调整', '互补色', {
    inExample: '#ff0000', outExample: '#00ffff',
    run: (ctx) => {
      const h = rgbToHsl(C(ctx));
      return toHex(hslToRgb({ h: h.h + 180, s: h.s, l: h.l }));
    },
  }),
  mk('invert', '调整', '反色', {
    inExample: '#ff0000', outExample: '#00ffff',
    run: (ctx) => { const c = C(ctx); return toHex({ r: 255 - c.r, g: 255 - c.g, b: 255 - c.b }); },
  }),
  mk('grayscale', '调整', '转灰度（按感知亮度加权）', {
    inExample: '#ff0000', outExample: '#363636',
    run: (ctx) => {
      const { r, g, b } = C(ctx);
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return toHex({ r: y, g: y, b: y });
    },
  }),

  /* ---------- 组合 ---------- */
  mk('mix', '组合', '混合两个颜色，第 3 个值为 B 的占比(0~100，默认 50)', {
    inDesc: '颜色A 颜色B [占比]', inExample: '#ff0000 #0000ff', outExample: '#800080',
    run: (ctx) => {
      const t = ctx.desc.tokens();
      const a = parseColor(t[0]);
      const b = parseColor(t[1]);
      const ratio = t[2] === undefined ? 0.5 : clamp(Number(t[2]) / 100, 0, 1);
      return toHex({
        r: a.r * (1 - ratio) + b.r * ratio,
        g: a.g * (1 - ratio) + b.g * ratio,
        b: a.b * (1 - ratio) + b.b * ratio,
      });
    },
  }),
  mk('gradient', '组合', '生成渐变色卡，输入 "颜色A 颜色B 步数"，每行一个色值', {
    inDesc: '颜色A 颜色B 步数', outLayout: 'rows',
    inExample: '#000000 #ffffff 3', outExample: '#000000\n#808080\n#ffffff',
    run: (ctx) => {
      const t = ctx.desc.tokens();
      if (t.length < 3) throw inputError('需要 3 个值：颜色A 颜色B 步数');
      const a = parseColor(t[0]);
      const b = parseColor(t[1]);
      const n = Math.max(2, Math.trunc(Number(t[2])));
      return Array.from({ length: n }, (_, i) => {
        const k = i / (n - 1);
        return toHex({ r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k });
      }).join('\n');
    },
  }),

  /* ---------- 度量 ---------- */
  mk('luminance', '度量', 'WCAG 相对亮度 0~1', {
    outLayout: 'number', inExample: '#ffffff', outExample: 1,
    run: (ctx) => fmt(luminance(C(ctx))),
  }),
  mk('contrast_ratio', '度量', '两色对比度（WCAG 1~21），并给出 AA/AAA 结论', {
    inDesc: '两个颜色', inExample: '#000000 #ffffff', outExample: '21 A AA AAA',
    run: (ctx) => {
      const [a, b] = CS(ctx, 2);
      const r = contrastRatio(a, b);
      const lv = [`${fmt(r)}`, r >= 3 ? 'A' : '-', r >= 4.5 ? 'AA' : '-', r >= 7 ? 'AAA' : '-'];
      return lv.join(' ');
    },
  }),
  mk('is_light', '度量', '是否为浅色，输出 true/false', {
    outLayout: 'boolean', inExample: '#ffffff', outExample: 'true',
    run: (ctx) => String(luminance(C(ctx)) > 0.179),
  }),
  mk('is_dark', '度量', '是否为深色，输出 true/false', {
    outLayout: 'boolean', inExample: '#000000', outExample: 'true',
    run: (ctx) => String(luminance(C(ctx)) <= 0.179),
  }),
  mk('distance', '度量', '两色的 RGB 欧氏距离', {
    inDesc: '两个颜色', outLayout: 'number', inExample: '#000000 #ffffff', outExample: 441.67295593,
    run: (ctx) => {
      const [a, b] = CS(ctx, 2);
      return fmt(Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2));
    },
  }),
];

module.exports = {
  name: 'color_tool',
  title: '颜色工具',
  category: '设计 / 视觉',
  summary: 'HEX/RGB/HSL/HSV/CMYK 互转、明暗与饱和度调整、混色渐变、WCAG 对比度',
  version: require('../../package.json').version,
  functions,
};

module.exports._parseColor = parseColor;
module.exports._contrastRatio = contrastRatio;
module.exports._luminance = luminance;
