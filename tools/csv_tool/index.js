'use strict';

const { usageError, inputError } = require('../../lib/errors');
const { fmt, sum, mean, quantile } = require('../../lib/num');
const table = require('../../lib/table');

/** RFC4180 风格 CSV 解析：支持引号包裹、"" 转义、\r\n */
function parseCsv(text, delim = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  let i = 0;
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  while (i < s.length) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === delim) { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function escField(v, delim) {
  const s = v === undefined || v === null ? '' : String(v);
  const need = s.includes(delim) || s.includes('"') || s.includes('\n') || s.includes('\r');
  return need ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows, delim = ',') {
  return rows.map((r) => r.map((v) => escField(v, delim)).join(delim)).join('\n');
}

/** 读取表格：返回 { header, rows(二维数组), delim } */
function readTable(ctx) {
  const delim = ctx.opts.delim === undefined ? ',' : ctx.opts.delim;
  const raw = ctx.desc.payload();
  const all = parseCsv(raw, delim);
  if (!all.length) throw inputError('input.desc 为空或不含有效 CSV 行');
  if (ctx.opts.no_header) {
    const width = Math.max(...all.map((r) => r.length));
    const header = Array.from({ length: width }, (_, i) => `col${i + 1}`);
    return { header, rows: all, delim };
  }
  const header = all[0];
  const rows = all.slice(1).map((r) => {
    if (r.length < header.length) return r.concat(Array(header.length - r.length).fill(''));
    return r.slice(0, header.length);
  });
  return { header, rows, delim };
}

function out({ header, rows, delim }) {
  return toCsv([header, ...rows], delim);
}

function colIndex(header, name) {
  const i = header.indexOf(name);
  if (i < 0) throw inputError(`找不到列: ${name}`, `可用列: ${header.join(', ')}`);
  return i;
}

function mk(name, group, summary, o) {
  return {
    name, group, summary,
    args: o.args || [],
    input: { kind: 'text', layout: 'csv', desc: o.inDesc || 'CSV 文本，第 1 行为表头', example: o.inExample },
    output: { layout: o.outLayout || 'csv', desc: o.outDesc || 'CSV 文本', example: o.outExample },
    examples: o.inExample !== undefined && o.outExample !== undefined
      ? [{ input: String(o.inExample), opts: o.exOpts, expect: String(o.outExample) }] : [],
    run: o.run,
  };
}

const DELIM = { long: '--delim', default: ',', desc: '字段分隔符，默认 ","' };
const NOHEADER = { long: '--no-header', flag: true, desc: '输入无表头，列名用 col1 col2 ...' };
const need = (ctx, k, hint) => {
  const v = ctx.opts[k];
  if (v === undefined || v === null || v === '') throw usageError(`缺少必填选项 --${k}`, hint);
  return v;
};

const OPS = {
  eq: (a, b) => a === b,
  ne: (a, b) => a !== b,
  gt: (a, b) => Number(a) > Number(b),
  gte: (a, b) => Number(a) >= Number(b),
  lt: (a, b) => Number(a) < Number(b),
  lte: (a, b) => Number(a) <= Number(b),
  contains: (a, b) => a.includes(b),
  starts: (a, b) => a.startsWith(b),
  ends: (a, b) => a.endsWith(b),
  regex: (a, b) => new RegExp(b).test(a),
};

const functions = [
  mk('info', '概览', '输出行列数与列名', {
    args: [DELIM, NOHEADER], outLayout: 'kv', outDesc: '每行一项：键 值',
    inExample: 'name,age\nTom,18\nAnn,20',
    outExample: 'rows 2\ncols 2\ncolumns name,age',
    run: (ctx) => {
      const t = readTable(ctx);
      return `rows ${t.rows.length}\ncols ${t.header.length}\ncolumns ${t.header.join(',')}`;
    },
  }),
  mk('count', '概览', '数据行数（不含表头）', {
    args: [DELIM, NOHEADER], outLayout: 'number',
    inExample: 'a\n1\n2\n3', outExample: 3,
    run: (ctx) => String(readTable(ctx).rows.length),
  }),
  mk('pretty', '概览', '对齐成等宽文本表格', {
    args: [DELIM, NOHEADER], outLayout: 'text',
    inExample: 'name,age\nTom,18', outExample: 'NAME  AGE\n----  ---\nTom   18',
    run: (ctx) => {
      const t = readTable(ctx);
      return table.render([t.header.map((h) => h.toUpperCase()), ...t.rows], { header: true });
    },
  }),

  /* ---------- 转换 ---------- */
  mk('to_json', '转换', 'CSV 转 JSON 数组（每行为一个对象）', {
    args: [DELIM, NOHEADER], outLayout: 'json',
    inExample: 'name,age\nTom,18', outExample: '[\n  {\n    "name": "Tom",\n    "age": "18"\n  }\n]',
    run: (ctx) => {
      const t = readTable(ctx);
      return JSON.stringify(t.rows.map((r) => Object.fromEntries(t.header.map((h, i) => [h, r[i]]))), null, 2);
    },
  }),
  mk('from_json', '转换', 'JSON 对象数组转 CSV', {
    args: [DELIM], inDesc: 'JSON 对象数组', inLayout: 'json',
    inExample: '[{"name":"Tom","age":18}]', outExample: 'name,age\nTom,18',
    run: (ctx) => {
      const arr = ctx.desc.json();
      if (!Array.isArray(arr) || !arr.length) throw inputError('需要非空的 JSON 对象数组');
      const header = [...new Set(arr.flatMap((o) => (o && typeof o === 'object' ? Object.keys(o) : [])))];
      const rows = arr.map((o) => header.map((h) => (o && o[h] !== undefined ? o[h] : '')));
      return toCsv([header, ...rows], ctx.opts.delim === undefined ? ',' : ctx.opts.delim);
    },
  }),
  mk('transpose', '转换', '行列转置', {
    args: [DELIM, NOHEADER],
    inExample: 'a,b\n1,2', outExample: 'a,1\nb,2',
    run: (ctx) => {
      const t = readTable(ctx);
      const m = [t.header, ...t.rows];
      const w = Math.max(...m.map((r) => r.length));
      return toCsv(Array.from({ length: w }, (_, i) => m.map((r) => r[i] === undefined ? '' : r[i])), t.delim);
    },
  }),

  /* ---------- 选择 ---------- */
  mk('select', '选择', '挑选列，--cols 逗号分隔', {
    args: [DELIM, NOHEADER, { long: '--cols', desc: '列名，逗号分隔（必填）' }],
    inExample: 'a,b,c\n1,2,3', outExample: 'a,c\n1,3', exOpts: { cols: 'a,c' },
    run: (ctx) => {
      const t = readTable(ctx);
      const names = String(need(ctx, 'cols')).split(',').map((s) => s.trim()).filter(Boolean);
      const idx = names.map((n) => colIndex(t.header, n));
      return out({ header: names, rows: t.rows.map((r) => idx.map((i) => r[i])), delim: t.delim });
    },
  }),
  mk('head', '选择', '取前 --n 行', {
    args: [DELIM, NOHEADER, { short: '-n', long: '--n', type: 'number', default: 10, desc: '行数' }],
    inExample: 'a\n1\n2\n3', outExample: 'a\n1\n2', exOpts: { n: 2 },
    run: (ctx) => {
      const t = readTable(ctx);
      return out({ ...t, rows: t.rows.slice(0, ctx.opts.n || 10) });
    },
  }),
  mk('tail', '选择', '取后 --n 行', {
    args: [DELIM, NOHEADER, { short: '-n', long: '--n', type: 'number', default: 10, desc: '行数' }],
    inExample: 'a\n1\n2\n3', outExample: 'a\n2\n3', exOpts: { n: 2 },
    run: (ctx) => {
      const t = readTable(ctx);
      return out({ ...t, rows: t.rows.slice(-(ctx.opts.n || 10)) });
    },
  }),
  mk('filter', '选择', '按列筛选：--col --op --value', {
    args: [DELIM, NOHEADER, { long: '--col', desc: '列名（必填）' }, {
      long: '--op', default: 'eq', desc: 'eq|ne|gt|gte|lt|lte|contains|starts|ends|regex',
    }, { long: '--value', default: '', desc: '比较值' }],
    inExample: 'n\n1\n5\n9', outExample: 'n\n5\n9', exOpts: { col: 'n', op: 'gte', value: '5' },
    run: (ctx) => {
      const t = readTable(ctx);
      const i = colIndex(t.header, need(ctx, 'col'));
      const op = OPS[ctx.opts.op || 'eq'];
      if (!op) throw usageError(`不支持的比较符: ${ctx.opts.op}`);
      const v = ctx.opts.value === undefined ? '' : String(ctx.opts.value);
      return out({ ...t, rows: t.rows.filter((r) => op(r[i] === undefined ? '' : r[i], v)) });
    },
  }),
  mk('sort', '选择', '按列排序，--desc 降序，--numeric 数值比较', {
    args: [DELIM, NOHEADER, { long: '--by', desc: '列名（必填）' }, { long: '--desc', flag: true, desc: '降序' }, { long: '--numeric', flag: true, desc: '按数值比较' }],
    inExample: 'n\n3\n1\n2', outExample: 'n\n1\n2\n3', exOpts: { by: 'n', numeric: true },
    run: (ctx) => {
      const t = readTable(ctx);
      const i = colIndex(t.header, need(ctx, 'by'));
      const rows = [...t.rows].sort((a, b) => {
        const x = a[i] === undefined ? '' : a[i];
        const y = b[i] === undefined ? '' : b[i];
        let c = ctx.opts.numeric ? Number(x) - Number(y)
          : (/^-?\d+(\.\d+)?$/.test(x) && /^-?\d+(\.\d+)?$/.test(y) ? Number(x) - Number(y) : String(x).localeCompare(String(y)));
        return ctx.opts.desc ? -c : c;
      });
      return out({ ...t, rows });
    },
  }),
  mk('dedupe', '选择', '按整行去重，--col 指定按某列去重', {
    args: [DELIM, NOHEADER, { long: '--col', desc: '按该列去重，缺省按整行' }],
    inExample: 'a\n1\n1\n2', outExample: 'a\n1\n2',
    run: (ctx) => {
      const t = readTable(ctx);
      const seen = new Set();
      const rows = [];
      const i = ctx.opts.col ? colIndex(t.header, ctx.opts.col) : -1;
      for (const r of t.rows) {
        const k = i >= 0 ? r[i] : r.join('\u0001');
        if (seen.has(k)) continue;
        seen.add(k); rows.push(r);
      }
      return out({ ...t, rows });
    },
  }),

  /* ---------- 聚合 ---------- */
  mk('aggregate', '聚合', '对列做聚合：--col --fn (sum|mean|min|max|count|median|stdev)', {
    args: [DELIM, NOHEADER, { long: '--col', desc: '列名（必填）' }, {
      long: '--fn', default: 'sum', desc: 'sum|mean|min|max|count|median|stdev',
    }],
    outLayout: 'number',
    inExample: 'n\n1\n2\n3', outExample: 6, exOpts: { col: 'n', fn: 'sum' },
    run: (ctx) => {
      const t = readTable(ctx);
      const i = colIndex(t.header, need(ctx, 'col'));
      const nums = t.rows.map((r) => Number(r[i])).filter((v) => Number.isFinite(v));
      const fn = ctx.opts.fn || 'sum';
      const m = mean(nums);
      const val = {
        sum: () => sum(nums),
        mean: () => m,
        min: () => Math.min(...nums),
        max: () => Math.max(...nums),
        count: () => nums.length,
        median: () => quantile([...nums].sort((a, b) => a - b), 0.5),
        stdev: () => Math.sqrt(sum(nums.map((v) => (v - m) ** 2)) / nums.length),
      }[fn];
      if (!val) throw usageError(`不支持的聚合函数: ${fn}`);
      return fmt(val());
    },
  }),
  mk('stats', '聚合', '数值列描述统计', {
    args: [DELIM, NOHEADER, { long: '--col', desc: '列名（必填）' }],
    outLayout: 'kv', outDesc: '每行一项：键 值',
    inExample: 'n\n1\n2\n3', outExample: 'count 3\nsum 6\nmean 2\nmin 1\nmax 3\nmedian 2\nstdev 0.816496580928',
    exOpts: { col: 'n' },
    run: (ctx) => {
      const t = readTable(ctx);
      const i = colIndex(t.header, need(ctx, 'col'));
      const nums = t.rows.map((r) => Number(r[i])).filter((v) => Number.isFinite(v));
      if (!nums.length) throw inputError('该列没有可解析的数值');
      const m = mean(nums);
      const sd = Math.sqrt(sum(nums.map((v) => (v - m) ** 2)) / nums.length);
      const s = [...nums].sort((a, b) => a - b);
      return [
        `count ${nums.length}`, `sum ${fmt(sum(nums))}`, `mean ${fmt(m)}`,
        `min ${fmt(Math.min(...nums))}`, `max ${fmt(Math.max(...nums))}`,
        `median ${fmt(quantile(s, 0.5))}`, `stdev ${fmt(sd)}`,
      ].join('\n');
    },
  }),
  mk('group_by', '聚合', '分组聚合：--by 分组列，--agg "列:函数" 可多次用逗号分隔', {
    args: [DELIM, NOHEADER, { long: '--by', desc: '分组列（必填）' }, { long: '--agg', desc: '如 "n:sum,m:mean"（必填）' }],
    inExample: 'g,n\na,1\na,2\nb,5', outExample: 'g,n_sum\na,3\nb,5', exOpts: { by: 'g', agg: 'n:sum' },
    run: (ctx) => {
      const t = readTable(ctx);
      const gi = colIndex(t.header, need(ctx, 'by'));
      const specs = String(need(ctx, 'agg')).split(',').map((s) => {
        const [c, f] = s.split(':').map((x) => x.trim());
        return { col: c, fn: f || 'sum', idx: colIndex(t.header, c) };
      });
      const groups = new Map();
      for (const r of t.rows) {
        const k = r[gi] === undefined ? '' : r[gi];
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      }
      const AGG = {
        sum: (n) => sum(n),
        mean: (n) => mean(n),
        min: (n) => Math.min(...n),
        max: (n) => Math.max(...n),
        count: (n) => n.length,
        median: (n) => quantile([...n].sort((a, b) => a - b), 0.5),
        stdev: (n) => { const m = mean(n); return Math.sqrt(sum(n.map((v) => (v - m) ** 2)) / n.length); },
      };
      const header = [ctx.opts.by, ...specs.map((s) => `${s.col}_${s.fn}`)];
      const rows = [];
      for (const [k, rs] of groups) {
        const cells = specs.map((s) => {
          if (!AGG[s.fn]) throw usageError(`不支持的聚合函数: ${s.fn}`);
          const nums = rs.map((r) => Number(r[s.idx])).filter((v) => Number.isFinite(v));
          return nums.length ? fmt(AGG[s.fn](nums)) : '';
        });
        rows.push([k, ...cells]);
      }
      return out({ header, rows, delim: t.delim });
    },
  }),
  mk('unique', '聚合', '某列的去重值，每行一个', {
    args: [DELIM, NOHEADER, { long: '--col', desc: '列名（必填）' }],
    outLayout: 'rows',
    inExample: 'g\na\nb\na', outExample: 'a\nb', exOpts: { col: 'g' },
    run: (ctx) => {
      const t = readTable(ctx);
      const i = colIndex(t.header, need(ctx, 'col'));
      return [...new Set(t.rows.map((r) => r[i]))].join('\n');
    },
  }),
];

module.exports = {
  name: 'csv_tool',
  title: 'CSV 表格工具',
  category: '通用 / 数据',
  summary: 'CSV 解析与生成、列选择筛选排序、去重、聚合统计、JSON 互转',
  version: require('../../package.json').version,
  functions,
};
