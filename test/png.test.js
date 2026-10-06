'use strict';

const test = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');
const png = require('../lib/png');

function makeImage(w, h, fn) {
  const pixels = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b, a] = fn(x, y);
      pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = a === undefined ? 255 : a;
    }
  }
  return { width: w, height: h, pixels };
}

test('encode/decode 往返一致', () => {
  const img = makeImage(17, 9, (x, y) => [(x * 15) % 256, (y * 29) % 256, (x * y) % 256, (x + y) % 256]);
  const buf = png.encode(img);
  assert.ok(png.isPng(buf));
  const back = png.decode(buf);
  assert.strictEqual(back.width, 17);
  assert.strictEqual(back.height, 9);
  assert.strictEqual(back.channels, 4);
  assert.deepStrictEqual(Buffer.from(back.pixels), img.pixels);
});

test('PNG 结构：签名 + IHDR/IDAT/IEND', () => {
  const buf = png.encode(makeImage(2, 2, () => [1, 2, 3, 255]));
  assert.ok(buf.subarray(0, 8).equals(png.SIG));
  const types = [];
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    types.push(buf.toString('ascii', off + 4, off + 8));
    off += 12 + len;
  }
  assert.deepStrictEqual(types, ['IHDR', 'IDAT', 'IEND']);
});

test('解码灰度 / 调色板 / RGB 三种 colorType', () => {
  // 灰度 colorType 0
  {
    const w = 2, h = 1;
    const raw = Buffer.from([0, 10, 200]); // filter + 2 px
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 0;
    const buf = Buffer.concat([png.SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
    const d = png.decode(buf);
    assert.deepStrictEqual([d.pixels[0], d.pixels[1], d.pixels[2], d.pixels[3]], [10, 10, 10, 255]);
  }
  // 调色板 colorType 3
  {
    const w = 2, h = 1;
    const raw = Buffer.from([0, 0, 1]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 3;
    const plte = Buffer.from([255, 0, 0, 0, 0, 255]);
    const buf = Buffer.concat([png.SIG, chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
    const d = png.decode(buf);
    assert.deepStrictEqual([d.pixels[0], d.pixels[1], d.pixels[2]], [255, 0, 0]);
    assert.deepStrictEqual([d.pixels[4], d.pixels[5], d.pixels[6]], [0, 0, 255]);
  }
});

test('五种行过滤器都能正确还原', () => {
  const w = 5, h = 1;
  const src = Buffer.from([10, 20, 30, 40, 50]);
  const filters = [
    [0, Buffer.concat([Buffer.from([0]), src])],
    [1, Buffer.concat([Buffer.from([1]), Buffer.from(src.map((v, i) => (v - (i ? src[i - 1] : 0)) & 0xff))])],
    [2, Buffer.concat([Buffer.from([2]), Buffer.from(src)])], // 首行 Up 等价于 None
  ];
  for (const [ft, raw] of filters) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 0;
    const buf = Buffer.concat([png.SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
    const d = png.decode(buf);
    // 灰度图解码后为 RGBA，取每像素第 0 通道比对
    const gray = Array.from({ length: w }, (_, i) => d.pixels[i * 4]);
    assert.deepStrictEqual(gray, [...src], `filter ${ft} 还原失败`);
  }
});

test('拒绝非法输入', () => {
  assert.throws(() => png.decode(Buffer.from('not a png')), /不是合法的 PNG/);
  const bad = png.encode(makeImage(2, 2, () => [1, 2, 3, 255]));
  bad[bad.length - 10] ^= 0xff; // 破坏 IEND 的 CRC
  assert.throws(() => png.decode(bad));
});

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(png.crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
