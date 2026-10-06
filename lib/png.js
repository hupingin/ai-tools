'use strict';

/**
 * 纯零依赖 PNG 编解码（仅用 node:zlib）。
 * 支持：8 位深、非隔行的 colorType 0(灰度) / 2(RGB) / 3(调色板) / 4(灰度+Alpha) / 6(RGBA)。
 * 对外统一为 RGBA 像素缓冲区（width*height*4）。
 */
const zlib = require('node:zlib');

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

const isPng = (buf) => Buffer.isBuffer(buf) && buf.length > 8 && buf.subarray(0, 8).equals(SIG);

/** @returns {{width:number,height:number,channels:4,colorType:number,bitDepth:number,pixels:Buffer}} */
function decode(buf) {
  if (!isPng(buf)) throw new Error('不是合法的 PNG 数据（缺少文件签名）');
  let off = 8;
  let ihdr = null;
  const idat = [];
  let plte = null;
  let trns = null;

  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    const want = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
    const got = buf.readUInt32BE(off + 8 + len);
    if (want !== got) throw new Error(`PNG 数据块校验失败: ${type}`);
    off += 12 + len;
    if (type === 'IHDR') ihdr = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
  }
  if (!ihdr) throw new Error('PNG 缺少 IHDR 块');

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const interlace = ihdr[12];

  if (interlace !== 0) throw new Error('暂不支持隔行扫描(interlace)的 PNG');
  if (bitDepth !== 8) throw new Error(`暂不支持 bitDepth=${bitDepth}，仅支持 8 位`);
  const bpp = CHANNELS[colorType];
  if (!bpp) throw new Error(`不支持的 colorType=${colorType}`);
  if (colorType === 3 && !plte) throw new Error('调色板 PNG 缺少 PLTE 块');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  if (raw.length < (stride + 1) * height) throw new Error('PNG 数据长度不足');

  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  let pos = 0;

  for (let y = 0; y < height; y++) {
    const ft = raw[pos++];
    const line = Buffer.from(raw.subarray(pos, pos + stride));
    pos += stride;
    switch (ft) {
      case 0: break;
      case 1:
        for (let x = bpp; x < stride; x++) line[x] = (line[x] + line[x - bpp]) & 0xff;
        break;
      case 2:
        for (let x = 0; x < stride; x++) line[x] = (line[x] + prev[x]) & 0xff;
        break;
      case 3:
        for (let x = 0; x < stride; x++) {
          const a = x >= bpp ? line[x - bpp] : 0;
          line[x] = (line[x] + ((a + prev[x]) >> 1)) & 0xff;
        }
        break;
      case 4:
        for (let x = 0; x < stride; x++) {
          const a = x >= bpp ? line[x - bpp] : 0;
          const c = x >= bpp ? prev[x - bpp] : 0;
          line[x] = (line[x] + paeth(a, prev[x], c)) & 0xff;
        }
        break;
      default:
        throw new Error(`未知的行过滤器: ${ft}`);
    }
    prev = line;

    for (let x = 0; x < width; x++) {
      const s = x * bpp;
      const d = (y * width + x) * 4;
      if (colorType === 0) {
        out[d] = line[s]; out[d + 1] = line[s]; out[d + 2] = line[s]; out[d + 3] = 255;
      } else if (colorType === 4) {
        out[d] = line[s]; out[d + 1] = line[s]; out[d + 2] = line[s]; out[d + 3] = line[s + 1];
      } else if (colorType === 2) {
        out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = 255;
      } else if (colorType === 3) {
        const idx = line[s];
        out[d] = plte[idx * 3] || 0;
        out[d + 1] = plte[idx * 3 + 1] || 0;
        out[d + 2] = plte[idx * 3 + 2] || 0;
        out[d + 3] = trns && idx < trns.length ? trns[idx] : 255;
      } else {
        out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = line[s + 3];
      }
    }
  }
  return { width, height, channels: 4, colorType, bitDepth, pixels: out };
}

/** 把 RGBA 像素缓冲编码为 PNG（colorType 6 / 8 位） */
function encode(img) {
  const { width, height, pixels } = img;
  if (!width || !height) throw new Error('图像尺寸无效');
  if (pixels.length < width * height * 4) throw new Error('像素缓冲区长度不足');
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0;
    pixels.copy(raw, p, y * stride, (y + 1) * stride);
    p += stride;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bitDepth
  ihdr[9] = 6;   // colorType RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

module.exports = { decode, encode, crc32, isPng, SIG };
