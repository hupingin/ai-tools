'use strict';

/** 极简等宽文本表格（无依赖） */
function render(rows, opts = {}) {
  const { sep = '  ', header = false, align = [] } = opts;
  if (!rows.length) return '';
  const ncol = Math.max(...rows.map((r) => r.length));
  const width = new Array(ncol).fill(0);
  for (const r of rows) {
    for (let c = 0; c < ncol; c++) {
      const v = r[c] === undefined || r[c] === null ? '' : String(r[c]);
      width[c] = Math.max(width[c], dispLen(v));
    }
  }
  const pad = (v, c) => {
    const s = v === undefined || v === null ? '' : String(v);
    const diff = width[c] - dispLen(s);
    if (diff <= 0) return s;
    const a = align[c] === 'r' ? ' '.repeat(diff) + s
      : align[c] === 'c' ? ' '.repeat(Math.floor(diff / 2)) + s + ' '.repeat(Math.ceil(diff / 2))
        : s + ' '.repeat(diff);
    return a;
  };
  const lines = rows.map((r) => {
    const cells = [];
    for (let c = 0; c < ncol; c++) cells.push(pad(r[c], c));
    return cells.join(sep).replace(/\s+$/, '');
  });
  if (header && lines.length > 1) {
    const bar = width.map((w) => '-'.repeat(w)).join(sep);
    lines.splice(1, 0, bar);
  }
  return lines.join('\n');
}

/** 粗略显示宽度：CJK 算 2 */
function dispLen(s) {
  let n = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    n += (c >= 0x1100 && (c <= 0x115f || c === 0x2329 || c === 0x232a ||
      (c >= 0x2e80 && c <= 0xa4cf && c !== 0x303f) ||
      (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6) || (c >= 0x20000 && c <= 0x3fffd))) ? 2 : 1;
  }
  return n;
}

module.exports = { render, dispLen };
