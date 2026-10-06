'use strict';

const { fmt } = require('../../lib/num');
const { usageError } = require('../../lib/errors');

/** 全文负载：保留首尾空格，只去掉末尾一个换行 */
const P = (ctx) => ctx.desc.payload();
/** 按行负载：保留每行缩进 */
const PL = (ctx) => P(ctx).split('\n');
/** 取前 n 行作为独立字符串（会 trim） */
const STR = (ctx, n = 2) => ctx.desc.lines().slice(0, n);

function mk(name, group, summary, o) {
  return {
    name, group, summary,
    args: o.args || [],
    input: { kind: 'text', layout: o.inLayout || 'text', desc: o.inDesc || '整段文本即 input.desc 全文', example: o.inExample },
    output: { layout: o.outLayout || 'text', desc: o.outDesc || '处理后的文本', example: o.outExample },
    examples: o.inExample !== undefined && o.outExample !== undefined
      ? [{ input: String(o.inExample), opts: o.exOpts, positional: o.exPositional, expect: String(o.outExample) }] : [],
    run: o.run,
  };
}

function need(ctx, key, hint) {
  const v = ctx.opts[key];
  if (v === undefined || v === null || v === '') {
    throw usageError(`缺少必填选项 --${key}`, hint);
  }
  return v;
}

function words(s) {
  return s.split(/\s+/).filter(Boolean);
}

/** 命名风格切词：支持 camelCase / snake_case / kebab-case / 空格 */
function tokenize(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

const functions = [
  /* ---------- 统计 ---------- */
  mk('stats', '统计', '输出字符/词/行/字节统计', {
    outLayout: 'kv', outDesc: '每行一项：键 值',
    inExample: 'hello world', outExample: 'chars 11\nchars_no_spaces 10\nwords 2\nlines 1\nbytes 11',
    run: (ctx) => {
      const s = P(ctx);
      return [
        `chars ${[...s].length}`,
        `chars_no_spaces ${[...s.replace(/\s/g, '')].length}`,
        `words ${words(s).length}`,
        `lines ${s === '' ? 0 : s.split('\n').length}`,
        `bytes ${Buffer.byteLength(s, 'utf8')}`,
      ].join('\n');
    },
  }),
  mk('count_chars', '统计', '字符数，--no-spaces 忽略空白', {
    args: [{ long: '--no-spaces', flag: true, desc: '不计空白字符' }],
    inExample: 'hello world', outExample: 11, outLayout: 'number',
    run: (ctx) => {
      const s = ctx.opts.no_spaces ? P(ctx).replace(/\s/g, '') : P(ctx);
      return String([...s].length);
    },
  }),
  mk('count_words', '统计', '词数（按空白分词；中文请用 count_chars）', {
    inExample: 'hello brave world', outExample: 3, outLayout: 'number',
    run: (ctx) => String(words(P(ctx)).length),
  }),
  mk('count_lines', '统计', '行数', {
    inExample: 'a\nb\nc', outExample: 3, outLayout: 'number',
    run: (ctx) => { const s = P(ctx); return String(s === '' ? 0 : s.split('\n').length); },
  }),
  mk('word_freq', '统计', '词频 Top N，输出每行 "词 次数"', {
    args: [{ short: '-n', long: '--top', type: 'number', default: 10, desc: '取前 N 个' }],
    outLayout: 'rows',
    inExample: 'a b a c b a', outExample: 'a 3\nb 2\nc 1',
    run: (ctx) => {
      const m = new Map();
      for (const w of words(P(ctx))) m.set(w, (m.get(w) || 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, ctx.opts.top || 10).map(([w, c]) => `${w} ${c}`).join('\n');
    },
  }),
  mk('char_freq', '统计', '字符频次 Top N，输出每行 "字符 次数"', {
    args: [{ short: '-n', long: '--top', type: 'number', default: 10, desc: '取前 N 个' }],
    outLayout: 'rows',
    inExample: 'aab', outExample: 'a 2\nb 1',
    run: (ctx) => {
      const m = new Map();
      for (const ch of P(ctx)) if (!/\s/.test(ch)) m.set(ch, (m.get(ch) || 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, ctx.opts.top || 10).map(([c, n]) => `${c} ${n}`).join('\n');
    },
  }),

  /* ---------- 大小写 ---------- */
  mk('upper', '大小写', '转大写', { inExample: 'hello', outExample: 'HELLO', run: (ctx) => P(ctx).toUpperCase() }),
  mk('lower', '大小写', '转小写', { inExample: 'HELLO', outExample: 'hello', run: (ctx) => P(ctx).toLowerCase() }),
  mk('title', '大小写', '每个词首字母大写', { inExample: 'hello world', outExample: 'Hello World', run: (ctx) => P(ctx).replace(/\w[^\s]*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()) }),
  mk('capitalize', '大小写', '首字母大写，其余小写', { inExample: 'hELLO', outExample: 'Hello', run: (ctx) => { const s = P(ctx); return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s; } }),
  mk('swapcase', '大小写', '大小写互换', { inExample: 'Hello', outExample: 'hELLO', run: (ctx) => P(ctx).replace(/[a-zA-Z]/g, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())) }),

  /* ---------- 命名风格 ---------- */
  mk('snake_case', '命名风格', '转为 snake_case', { inExample: 'HelloWorld', outExample: 'hello_world', run: (ctx) => tokenize(P(ctx)).map((w) => w.toLowerCase()).join('_') }),
  mk('kebab_case', '命名风格', '转为 kebab-case', { inExample: 'HelloWorld', outExample: 'hello-world', run: (ctx) => tokenize(P(ctx)).map((w) => w.toLowerCase()).join('-') }),
  mk('camel_case', '命名风格', '转为 camelCase', { inExample: 'hello world', outExample: 'helloWorld', run: (ctx) => tokenize(P(ctx)).map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('') }),
  mk('pascal_case', '命名风格', '转为 PascalCase', { inExample: 'hello world', outExample: 'HelloWorld', run: (ctx) => tokenize(P(ctx)).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('') }),
  mk('slugify', '命名风格', '转为 URL slug', { inExample: 'Hello, World!', outExample: 'hello-world', run: (ctx) => P(ctx).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }),

  /* ---------- 清洗 ---------- */
  mk('trim', '清洗', '去除首尾空白', { inExample: '  hi  ', outExample: 'hi', run: (ctx) => P(ctx).trim() }),
  mk('trim_start', '清洗', '去除开头空白', { inExample: '  hi  ', outExample: 'hi  ', run: (ctx) => P(ctx).replace(/^\s+/, '') }),
  mk('trim_end', '清洗', '去除结尾空白', { inExample: '  hi  ', outExample: '  hi', run: (ctx) => P(ctx).replace(/\s+$/, '') }),
  mk('strip_empty', '清洗', '删除空行', { inExample: 'a\n\nb', outExample: 'a\nb', run: (ctx) => PL(ctx).filter((l) => l.trim() !== '').join('\n') }),
  mk('dedent', '清洗', '去除每行公共缩进', { inExample: '    a\n    b', outExample: 'a\nb', run: (ctx) => {
    const lines = PL(ctx);
    const indents = lines.filter((l) => l.trim() !== '').map((l) => l.match(/^\s*/)[0].length);
    const m = indents.length ? Math.min(...indents) : 0;
    return lines.map((l) => l.slice(m)).join('\n');
  } }),
  mk('indent', '清洗', '每行加前缀，--n 空格数或 --prefix 自定义', {
    args: [{ short: '-n', long: '--n', type: 'number', default: 2, desc: '空格数' }, { long: '--prefix', desc: '自定义前缀，优先于 --n' }],
    inExample: 'a\nb', outExample: '  a\n  b',
    run: (ctx) => {
      const p = ctx.opts.prefix !== undefined ? ctx.opts.prefix : ' '.repeat(ctx.opts.n || 2);
      return PL(ctx).map((l) => p + l).join('\n');
    },
  }),
  mk('squeeze_blank', '清洗', '连续空行压缩为一行', { inExample: 'a\n\n\nb', outExample: 'a\n\nb', run: (ctx) => P(ctx).replace(/\n{3,}/g, '\n\n') }),

  /* ---------- 变换 ---------- */
  mk('reverse', '变换', '反转全文字符', { inExample: 'abc', outExample: 'cba', run: (ctx) => [...P(ctx)].reverse().join('') }),
  mk('reverse_lines', '变换', '反转行顺序', { inExample: 'a\nb\nc', outExample: 'c\nb\na', run: (ctx) => PL(ctx).reverse().join('\n') }),
  mk('repeat', '变换', '重复 N 次，--n 次数，--sep 分隔符', {
    args: [{ short: '-n', long: '--n', type: 'number', default: 2, desc: '重复次数' }, { long: '--sep', default: '', desc: '每次之间的分隔符' }],
    inExample: 'ab', outExample: 'abab', exOpts: { n: 2 },
    run: (ctx) => Array(Math.max(0, ctx.opts.n || 2)).fill(P(ctx)).join(ctx.opts.sep || ''),
  }),
  mk('pad_start', '变换', '左侧补齐到 --n 长度', {
    args: [{ short: '-n', long: '--n', type: 'number', default: 10, desc: '目标长度' }, { long: '--char', default: ' ', desc: '填充字符' }],
    inExample: '7', outExample: '         7', exOpts: { n: 10, char: ' ' },
    run: (ctx) => P(ctx).padStart(ctx.opts.n || 10, (ctx.opts.char || ' ')[0] || ' '),
  }),
  mk('pad_end', '变换', '右侧补齐到 --n 长度', {
    args: [{ short: '-n', long: '--n', type: 'number', default: 10, desc: '目标长度' }, { long: '--char', default: ' ', desc: '填充字符' }],
    inExample: '7', outExample: '7         ', exOpts: { n: 10, char: ' ' },
    run: (ctx) => P(ctx).padEnd(ctx.opts.n || 10, (ctx.opts.char || ' ')[0] || ' '),
  }),
  mk('truncate', '变换', '截断到 --n 字符并加后缀', {
    args: [{ short: '-n', long: '--n', type: 'number', default: 20, desc: '最大长度' }, { long: '--suffix', default: '...', desc: '截断后缀' }],
    inExample: 'abcdefghij', outExample: 'abcde...', exOpts: { n: 5, suffix: '...' },
    run: (ctx) => {
      const n = ctx.opts.n || 20, suf = ctx.opts.suffix || '...';
      const s = P(ctx);
      return [...s].length <= n ? s : [...s].slice(0, n).join('') + suf;
    },
  }),
  mk('wrap', '变换', '按 --width 折行', {
    args: [{ short: '-w', long: '--width', type: 'number', default: 80, desc: '行宽' }],
    inExample: 'aaa bbb ccc', outExample: 'aaa bbb\nccc', exOpts: { width: 7 },
    run: (ctx) => {
      const w = Math.max(1, ctx.opts.width || 80);
      const out = [];
      let line = '';
      for (const word of words(P(ctx))) {
        if (!line) line = word;
        else if (line.length + 1 + word.length <= w) line += ' ' + word;
        else { out.push(line); line = word; }
      }
      if (line) out.push(line);
      return out.join('\n');
    },
  }),

  /* ---------- 查找替换 ---------- */
  mk('replace', '查找替换', '替换文本，--from/--to，--regex 启用正则', {
    args: [
      { long: '--from', desc: '待替换内容（必填）' },
      { long: '--to', default: '', desc: '替换为，默认空串' },
      { long: '--regex', flag: true, desc: '把 --from 当正则，--flags 修饰符' },
      { long: '--flags', default: 'g', desc: '正则修饰符' },
    ],
    inExample: 'a-b-c', outExample: 'a b c', exOpts: { from: '-', to: ' ' },
    run: (ctx) => {
      const from = need(ctx, 'from', '例如 --from "-" --to " "');
      const to = ctx.opts.to === undefined ? '' : ctx.opts.to;
      const s = P(ctx);
      return ctx.opts.regex ? s.replace(new RegExp(from, ctx.opts.flags || 'g'), to) : s.split(from).join(to);
    },
  }),
  mk('contains', '查找替换', '是否包含 --needle，输出 true/false', {
    args: [{ long: '--needle', desc: '要查找的子串（必填）' }],
    outLayout: 'boolean', inExample: 'hello world', outExample: 'true', exOpts: { needle: 'world' },
    run: (ctx) => String(P(ctx).includes(need(ctx, 'needle'))),
  }),
  mk('starts_with', '查找替换', '是否以 --needle 开头', {
    args: [{ long: '--needle', desc: '前缀（必填）' }],
    outLayout: 'boolean', inExample: 'hello', outExample: 'true', exOpts: { needle: 'he' },
    run: (ctx) => String(P(ctx).startsWith(need(ctx, 'needle'))),
  }),
  mk('ends_with', '查找替换', '是否以 --needle 结尾', {
    args: [{ long: '--needle', desc: '后缀（必填）' }],
    outLayout: 'boolean', inExample: 'hello', outExample: 'true', exOpts: { needle: 'lo' },
    run: (ctx) => String(P(ctx).endsWith(need(ctx, 'needle'))),
  }),
  mk('extract', '查找替换', '按 --regex 抽取，每行一个匹配（--group 取指定捕获组）', {
    args: [{ long: '--regex', desc: '正则表达式（必填）' }, { short: '-g', long: '--group', type: 'number', default: 0, desc: '捕获组序号，0 表示整匹配' }, { long: '--flags', default: 'g', desc: '正则修饰符' }],
    outLayout: 'rows',
    inExample: 'a1 b22 c333', outExample: '1\n22\n333', exOpts: { regex: '\\d+' },
    run: (ctx) => {
      const re = new RegExp(need(ctx, 'regex', '例如 --regex "\\\\d+"'), ctx.opts.flags || 'g');
      const g = ctx.opts.group || 0;
      const out = [];
      let m;
      while ((m = re.exec(P(ctx))) !== null) {
        out.push(m[g] === undefined ? '' : m[g]);
        if (m[0] === '') re.lastIndex++;
      }
      return out.join('\n');
    },
  }),
  mk('substring', '查找替换', '截取子串，位置参数 [start] [end]', {
    inExample: 'hello world', outExample: 'hello', exPositional: ['0', '5'],
    run: (ctx) => {
      const start = Number(ctx.positional[0] ?? 0);
      const end = ctx.positional[1] === undefined ? undefined : Number(ctx.positional[1]);
      if (!Number.isFinite(start)) throw usageError('start 必须是数字');
      return [...P(ctx)].slice(start, end).join('');
    },
  }),

  /* ---------- 行操作 ---------- */
  mk('sort_lines', '行操作', '行排序，--desc 降序，--numeric 按数值', {
    args: [{ long: '--desc', flag: true, desc: '降序' }, { long: '--numeric', flag: true, desc: '按数值比较' }],
    inExample: '10\n9\nb', outExample: '9\n10\nb', exOpts: { numeric: true },
    run: (ctx) => {
      const cmp = ctx.opts.numeric
        ? (a, b) => Number(a) - Number(b)
        : (a, b) => a.localeCompare(b);
      const arr = PL(ctx).sort(cmp);
      return (ctx.opts.desc ? arr.reverse() : arr).join('\n');
    },
  }),
  mk('uniq', '行操作', '去重，--count 输出每行出现次数', {
    args: [{ long: '--count', flag: true, desc: '输出 "行 次数"' }],
    inExample: 'a\nb\na', outExample: 'a\nb',
    run: (ctx) => {
      if (ctx.opts.count) {
        const m = new Map();
        for (const l of PL(ctx)) m.set(l, (m.get(l) || 0) + 1);
        return [...m.entries()].map(([l, c]) => `${l} ${c}`).join('\n');
      }
      return [...new Set(PL(ctx))].join('\n');
    },
  }),
  mk('join', '行操作', '用 --sep 把多行连成一行', {
    args: [{ long: '--sep', default: ' ', desc: '连接符，默认空格' }],
    inExample: 'a\nb\nc', outExample: 'a,b,c', exOpts: { sep: ',' },
    run: (ctx) => PL(ctx).join(ctx.opts.sep === undefined ? ' ' : ctx.opts.sep),
  }),
  mk('split', '行操作', '用 --sep 把文本切成多行', {
    args: [{ long: '--sep', default: ' ', desc: '分隔符，默认空白' }],
    inExample: 'a,b,c', outExample: 'a\nb\nc', exOpts: { sep: ',' },
    run: (ctx) => P(ctx).split(ctx.opts.sep === undefined ? /\s+/ : ctx.opts.sep).join('\n'),
  }),
  mk('head', '行操作', '取前 --n 行', {
    args: [{ short: '-n', long: '--n', type: 'number', default: 10, desc: '行数' }],
    inExample: 'a\nb\nc', outExample: 'a\nb', exOpts: { n: 2 },
    run: (ctx) => PL(ctx).slice(0, ctx.opts.n || 10).join('\n'),
  }),
  mk('tail', '行操作', '取后 --n 行', {
    args: [{ short: '-n', long: '--n', type: 'number', default: 10, desc: '行数' }],
    inExample: 'a\nb\nc', outExample: 'b\nc', exOpts: { n: 2 },
    run: (ctx) => PL(ctx).slice(-(ctx.opts.n || 10)).join('\n'),
  }),

  /* ---------- 相似度 ---------- */
  mk('levenshtein', '相似度', '编辑距离（input 两行，每行一个字符串）', {
    inLayout: '两行，每行一个字符串',
    outLayout: 'number', inExample: 'kitten\nsitting', outExample: 3,
    run: (ctx) => {
      const [a, b] = STR(ctx, 2);
      return String(levenshtein(a, b));
    },
  }),
  mk('similarity', '相似度', '归一化相似度 0~1（input 两行，每行一个字符串）', {
    inLayout: '两行，每行一个字符串',
    outLayout: 'number', inExample: 'kitten\nsitting', outExample: 0.571428571429,
    run: (ctx) => {
      const [a, b] = STR(ctx, 2);
      const d = levenshtein(a, b);
      const m = Math.max(a.length, b.length);
      return fmt(m === 0 ? 1 : 1 - d / m);
    },
  }),
];

module.exports = {
  name: 'text_tool',
  title: '文本处理工具',
  category: '通用 / 文本',
  summary: '统计、大小写、命名风格、清洗、查找替换、行操作、相似度',
  version: require('../../package.json').version,
  functions,
};
