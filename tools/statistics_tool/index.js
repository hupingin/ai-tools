'use strict';

const { fmt, sum, mean, quantile } = require('../../lib/num');
const { inputError } = require('../../lib/errors');

/**
 * 单样本函数：input.desc 是一串空白/换行分隔的数字。
 */
function stat(name, group, summary, run, o = {}) {
  return {
    name, group, summary,
    args: o.args || [],
    input: { kind: 'values', layout: 'values', min: 1, desc: '一串数字，空白或换行分隔', example: o.inExample },
    output: { layout: o.outLayout || 'number', desc: o.outDesc || '统计量', example: o.outExample },
    examples: o.inExample !== undefined && o.outExample !== undefined
      ? [{ input: String(o.inExample), opts: o.exOpts, expect: String(o.outExample) }] : [],
    run: (ctx) => {
      const r = run(ctx.desc.numbers({ min: 1 }), ctx);
      return typeof r === 'number' ? fmt(r) : r;
    },
  };
}

/**
 * 配对样本函数：input.desc 两行，第一行 X 序列，第二行 Y 序列。
 */
function paired(name, summary, run, o = {}) {
  return {
    name, group: '双序列', summary,
    args: o.args || [],
    input: { kind: 'values', layout: '两行，每行为一串数字', min: 2, desc: '第 1 行 X 序列，第 2 行 Y 序列', example: o.inExample },
    output: { layout: o.outLayout || 'values', desc: o.outDesc || '', example: o.outExample },
    examples: o.inExample !== undefined && o.outExample !== undefined
      ? [{ input: String(o.inExample), expect: String(o.outExample) }] : [],
    run: (ctx) => {
      const lines = ctx.desc.lines();
      if (lines.length < 2) throw inputError('需要两行数据：第 1 行 X，第 2 行 Y');
      const parse = (s) => s.split(/\s+/).filter(Boolean).map((t) => {
        const v = Number(t);
        if (!Number.isFinite(v)) throw inputError(`不是有效数字: ${JSON.stringify(t)}`);
        return v;
      });
      const x = parse(lines[0]);
      const y = parse(lines[1]);
      if (x.length !== y.length) throw inputError(`两行长度不一致: X=${x.length}, Y=${y.length}`);
      if (x.length < 2) throw inputError('至少需要 2 组数据');
      const r = run(x, y, ctx);
      return typeof r === 'number' ? fmt(r) : r;
    },
  };
}

const sortedAsc = (a) => [...a].sort((p, q) => p - q);

function varianceOf(a, ddof) {
  const n = a.length;
  if (n - ddof <= 0) return NaN;
  const m = mean(a);
  return sum(a.map((v) => (v - m) * (v - m))) / (n - ddof);
}

/** 平均秩（并列取平均），Spearman 用 */
function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(a.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

function pearson(x, y) {
  const n = x.length;
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return NaN;
  return sxy / Math.sqrt(sxx * syy);
}

const DDOF = { short: '-d', long: '--ddof', type: 'number', default: 0, desc: '自由度修正：0=总体，1=样本' };

const functions = [
  /* ---------- 集中趋势 ---------- */
  stat('count', '描述统计', '样本个数', (a) => a.length, { inExample: '1 2 3', outExample: 3 }),
  stat('sum', '描述统计', '求和', (a) => sum(a), { inExample: '1 2 3 4', outExample: 10 }),
  stat('mean', '描述统计', '算术平均', (a) => mean(a), { inExample: '1 2 3 4 5', outExample: 3 }),
  stat('median', '描述统计', '中位数', (a) => quantile(sortedAsc(a), 0.5), { inExample: '3 1 2', outExample: 2 }),
  stat('mode', '描述统计', '众数（多个则全部输出）', (a) => {
    const m = new Map();
    for (const v of a) m.set(v, (m.get(v) || 0) + 1);
    const max = Math.max(...m.values());
    return [...m.entries()].filter(([, c]) => c === max).map(([v]) => v).join(' ');
  }, { inExample: '1 2 2 3 3 3', outExample: 3, outLayout: 'values' }),
  stat('geometric_mean', '描述统计', '几何平均', (a) => Math.pow(a.reduce((s, v) => s * v, 1), 1 / a.length), { inExample: '2 8', outExample: 4 }),
  stat('harmonic_mean', '描述统计', '调和平均', (a) => a.length / sum(a.map((v) => 1 / v)), { inExample: '1 2 4', outExample: 1.71428571429 }),

  /* ---------- 离散程度 ---------- */
  stat('range', '离散程度', '极差 (max - min)', (a) => Math.max(...a) - Math.min(...a), { inExample: '1 5 9', outExample: 8 }),
  stat('variance', '离散程度', '方差，--ddof 1 为样本方差', (a, ctx) => varianceOf(a, ctx.opts.ddof || 0), {
    args: [DDOF], inExample: '2 4 4 4 5 5 7 9', outExample: 4, exOpts: { ddof: 0 },
  }),
  stat('stdev', '离散程度', '标准差，--ddof 1 为样本标准差', (a, ctx) => Math.sqrt(varianceOf(a, ctx.opts.ddof || 0)), {
    args: [DDOF], inExample: '2 4 4 4 5 5 7 9', outExample: 2, exOpts: { ddof: 0 },
  }),
  stat('cv', '离散程度', '变异系数 stdev/mean', (a) => Math.sqrt(varianceOf(a, 0)) / mean(a), { inExample: '2 4 6', outExample: 0.408248290464 }),
  stat('mad', '离散程度', '平均绝对偏差', (a) => mean(a.map((v) => Math.abs(v - mean(a)))), { inExample: '1 2 3 4', outExample: 1 }),
  stat('iqr', '离散程度', '四分位距 Q3 - Q1', (a) => {
    const s = sortedAsc(a);
    return quantile(s, 0.75) - quantile(s, 0.25);
  }, { inExample: '1 2 3 4 5 6 7 8', outExample: 3.5 }),
  stat('quantile', '离散程度', '分位数，--q 指定概率 (0~1)', (a, ctx) => quantile(sortedAsc(a), ctx.opts.q), {
    args: [{ short: '-q', long: '--q', type: 'number', default: 0.5, desc: '概率，0~1' }],
    inExample: '1 2 3 4 5', outExample: 3, exOpts: { q: 0.5 },
  }),
  stat('percentile', '离散程度', '百分位数，--p 指定百分位 (0~100)', (a, ctx) => quantile(sortedAsc(a), ctx.opts.p / 100), {
    args: [{ short: '-p', long: '--p', type: 'number', default: 50, desc: '百分位，0~100' }],
    inExample: '1 2 3 4 5', outExample: 4, exOpts: { p: 75 },
  }),
  stat('outliers', '离散程度', 'IQR 法离群点（1.5×IQR 之外）', (a) => {
    const s = sortedAsc(a);
    const q1 = quantile(s, 0.25), q3 = quantile(s, 0.75);
    const iqr = q3 - q1;
    const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
    return a.filter((v) => v < lo || v > hi).join(' ');
  }, { inExample: '1 2 3 4 100', outExample: 100, outLayout: 'values' }),

  /* ---------- 变换 ---------- */
  stat('zscore', '变换', '标准化 z = (x - mean) / stdev', (a) => {
    const m = mean(a), sd = Math.sqrt(varianceOf(a, 0));
    return a.map((v) => (v - m) / sd).join(' ');
  }, { inExample: '1 2 3', outExample: '-1.22474487139 0 1.22474487139', outLayout: 'values' }),
  stat('normalize', '变换', 'Min-Max 归一化到 [0,1]', (a) => {
    const lo = Math.min(...a), hi = Math.max(...a);
    const d = hi - lo;
    return a.map((v) => (d === 0 ? 0 : (v - lo) / d)).join(' ');
  }, { inExample: '0 5 10', outExample: '0 0.5 1', outLayout: 'values' }),
  stat('cumsum', '变换', '累计和', (a) => {
    let s = 0;
    return a.map((v) => (s += v)).join(' ');
  }, { inExample: '1 2 3', outExample: '1 3 6', outLayout: 'values' }),
  stat('diff', '变换', '一阶差分（后项减前项）', (a) => a.slice(1).map((v, i) => v - a[i]).join(' '), { inExample: '1 3 6 10', outExample: '2 3 4', outLayout: 'values' }),
  stat('moving_average', '变换', '滑动平均，--window 窗口大小', (a, ctx) => {
    const w = Math.max(1, Math.floor(ctx.opts.window || 3));
    const out = [];
    for (let i = 0; i + w <= a.length; i++) out.push(mean(a.slice(i, i + w)));
    return out.join(' ');
  }, {
    args: [{ short: '-w', long: '--window', type: 'number', default: 3, desc: '窗口大小' }],
    inExample: '1 2 3 4 5', outExample: '2 3 4', outLayout: 'values',
  }),
  stat('sort', '变换', '排序，--desc 降序', (a, ctx) => {
    const s = sortedAsc(a);
    return (ctx.opts.desc ? s.reverse() : s).join(' ');
  }, {
    args: [{ long: '--desc', flag: true, desc: '降序' }],
    inExample: '3 1 2', outExample: '1 2 3', outLayout: 'values',
  }),
  stat('histogram', '变换', '直方图，--bins 指定桶数，输出每行 "下界 上界 计数"', (a, ctx) => {
    const bins = Math.max(1, Math.floor(ctx.opts.bins || 10));
    const lo = Math.min(...a), hi = Math.max(...a);
    const w = (hi - lo) / bins || 1;
    const cnt = new Array(bins).fill(0);
    for (const v of a) {
      let i = Math.floor((v - lo) / w);
      if (i >= bins) i = bins - 1;
      cnt[i]++;
    }
    return cnt.map((c, i) => `${fmt(lo + i * w)} ${fmt(lo + (i + 1) * w)} ${c}`).join('\n');
  }, {
    args: [{ short: '-b', long: '--bins', type: 'number', default: 10, desc: '桶数' }],
    inExample: '1 2 3 4 5', outExample: '1 1.4 1\n1.4 1.8 0\n1.8 2.2 1\n2.2 2.6 0\n2.6 3 0\n3 3.4 1\n3.4 3.8 0\n3.8 4.2 1\n4.2 4.6 0\n4.6 5 1',
    outLayout: 'rows',
  }),

  /* ---------- 双序列 ---------- */
  paired('covariance', '协方差', (x, y) => {
    const mx = mean(x), my = mean(y);
    let s = 0;
    for (let i = 0; i < x.length; i++) s += (x[i] - mx) * (y[i] - my);
    return s / x.length;
  }, { inExample: '1 2 3\n2 4 6', outExample: '1.33333333333' }),
  paired('correlation', '皮尔逊相关系数', (x, y) => pearson(x, y), { inExample: '1 2 3\n2 4 6', outExample: 1 }),
  paired('spearman', '斯皮尔曼秩相关系数', (x, y) => pearson(ranks(x), ranks(y)), { inExample: '1 2 3\n2 4 6', outExample: 1 }),
  paired('linear_regression', '一元线性回归 y = a + b·x，输出 "a b r2"', (x, y) => {
    const n = x.length;
    const mx = mean(x), my = mean(y);
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
    const b = sxx === 0 ? 0 : sxy / sxx;
    const a = my - b * mx;
    const r = pearson(x, y);
    return `${fmt(a)} ${fmt(b)} ${fmt(r * r)}`;
  }, { inExample: '1 2 3\n2 4 6', outExample: '0 2 1', outDesc: '截距 斜率 决定系数R²' }),
];

module.exports = {
  name: 'statistics_tool',
  title: '统计工具',
  category: '通用 / 数据',
  summary: '描述统计、离散程度、数据变换、双序列相关与回归',
  version: require('../../package.json').version,
  functions,
};
