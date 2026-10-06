'use strict';

const { usageError, inputError } = require('../../lib/errors');
const { fmt } = require('../../lib/num');

/**
 * 路径语法：a.b[0].c   （不支持含 "." 的键名）
 */
function parsePath(p) {
  if (p === '' || p === '$' || p === '.') return [];
  const out = [];
  const re = /([^.[\]]+)|\[(-?\d+)\]/g;
  let m;
  while ((m = re.exec(p)) !== null) {
    out.push(m[1] !== undefined ? m[1] : Number(m[2]));
  }
  if (!out.length) throw new usageError(`无法解析路径: ${JSON.stringify(p)}`);
  return out;
}

function getAt(root, parts) {
  let cur = root;
  for (const k of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[k];
  }
  return cur;
}

function setAt(root, parts, value) {
  if (!parts.length) throw new usageError('--path 不能为空（不支持替换根节点）');
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    const nk = parts[i + 1];
    if (cur[k] === null || typeof cur[k] !== 'object') {
      cur[k] = typeof nk === 'number' ? [] : {};
    }
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
  return root;
}

function delAt(root, parts) {
  if (!parts.length) throw new usageError('--path 不能为空');
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') return root;
    cur = cur[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (Array.isArray(cur)) cur.splice(last, 1);
  else delete cur[last];
  return root;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function walk(node, cb, path = '') {
  cb(node, path);
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, cb, `${path}[${i}]`));
  } else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) walk(node[k], cb, path ? `${path}.${k}` : k);
  }
}

function mk(name, group, summary, o) {
  return {
    name, group, summary,
    args: o.args || [],
    input: { kind: 'json', layout: 'json', desc: o.inDesc || '一段完整 JSON', example: o.inExample },
    output: { layout: o.outLayout || 'json', desc: o.outDesc || '', example: o.outExample },
    examples: o.inExample !== undefined && o.outExample !== undefined
      ? [{ input: String(o.inExample), opts: o.exOpts, expect: String(o.outExample) }] : [],
    run: o.run,
  };
}

const need = (ctx, k, hint) => {
  const v = ctx.opts[k];
  if (v === undefined || v === null || v === '') throw new usageError(`缺少必填选项 --${k}`, hint);
  return v;
};

const ARG_PATH = { short: '-p', long: '--path', desc: 'JSON 路径，如 a.b[0].c', default: '' };

function parseValue(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const functions = [
  /* ---------- 格式化 ---------- */
  mk('format', '格式化', '美化输出，--indent 缩进空格数', {
    args: [{ short: '-n', long: '--indent', type: 'number', default: 2, desc: '缩进空格数' }],
    inExample: '{"a":1,"b":[2,3]}',
    outExample: '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}',
    run: (ctx) => JSON.stringify(ctx.desc.json(), null, Math.max(0, ctx.opts.indent ?? 2)),
  }),
  mk('minify', '格式化', '压缩为单行', {
    inExample: '{ "a": 1, "b": [2] }', outExample: '{"a":1,"b":[2]}',
    run: (ctx) => JSON.stringify(ctx.desc.json()),
  }),
  mk('validate', '格式化', '校验 JSON 合法性，输出 "ok <类型>"', {
    outLayout: 'text', inExample: '[1,2]', outExample: 'ok array',
    run: (ctx) => { const v = ctx.desc.json(); return `ok ${typeOf(v)}`; },
  }),

  /* ---------- 读取 ---------- */
  mk('get', '读取', '按 --path 取值，输出该值的 JSON', {
    args: [ARG_PATH], outDesc: '路径对应的值（JSON）',
    inExample: '{"a":{"b":42}}', outExample: '42', exOpts: { path: 'a.b' },
    run: (ctx) => {
      const v = getAt(ctx.desc.json(), parsePath(need(ctx, 'path', '如 --path a.b[0]')));
      if (v === undefined) throw new inputError(`路径不存在: ${ctx.opts.path}`);
      return JSON.stringify(v, null, 2);
    },
  }),
  mk('keys', '读取', '取键名，--path 指定子树，--deep 递归全部路径', {
    args: [ARG_PATH, { long: '--deep', flag: true, desc: '递归输出所有叶子路径' }],
    outLayout: 'rows', outDesc: '每行一个键名/路径',
    inExample: '{"a":1,"b":2}', outExample: 'a\nb',
    run: (ctx) => {
      const node = ctx.opts.path ? getAt(ctx.desc.json(), parsePath(ctx.opts.path)) : ctx.desc.json();
      if (node === null || typeof node !== 'object') throw new inputError('目标不是对象或数组');
      if (ctx.opts.deep) {
        const out = [];
        walk(node, (v, p) => { if (v === null || typeof v !== 'object') out.push(p); });
        return out.join('\n');
      }
      return Object.keys(node).join('\n');
    },
  }),
  mk('values', '读取', '取所有值（JSON 数组）', {
    args: [ARG_PATH],
    inExample: '{"a":1,"b":2}', outExample: '[\n  1,\n  2\n]',
    run: (ctx) => {
      const node = ctx.opts.path ? getAt(ctx.desc.json(), parsePath(ctx.opts.path)) : ctx.desc.json();
      if (node === null || typeof node !== 'object') throw new inputError('目标不是对象或数组');
      return JSON.stringify(Object.values(node), null, 2);
    },
  }),
  mk('size', '读取', '统计节点数与最大深度', {
    outLayout: 'kv', outDesc: '每行一项：键 值',
    inExample: '{"a":[1,2]}', outExample: 'nodes 4\ndepth 3',
    run: (ctx) => {
      let nodes = 0, depth = 0;
      const rec = (n, d) => {
        nodes++; depth = Math.max(depth, d);
        if (Array.isArray(n)) n.forEach((v) => rec(v, d + 1));
        else if (n && typeof n === 'object') Object.values(n).forEach((v) => rec(v, d + 1));
      };
      rec(ctx.desc.json(), 1);
      return `nodes ${nodes}\ndepth ${depth}`;
    },
  }),
  mk('type', '读取', '取 --path 处的类型', {
    args: [ARG_PATH], outLayout: 'text',
    inExample: '{"a":[1]}', outExample: 'array', exOpts: { path: 'a' },
    run: (ctx) => typeOf(ctx.opts.path ? getAt(ctx.desc.json(), parsePath(ctx.opts.path)) : ctx.desc.json()),
  }),

  /* ---------- 修改 ---------- */
  mk('set', '修改', '设置 --path 处的值为 --value（自动识别 JSON 字面量）', {
    args: [ARG_PATH, { long: '--value', desc: '新值，JSON 字面量或普通字符串（必填）' }],
    inExample: '{"a":1}', outExample: '{\n  "a": 1,\n  "b": "x"\n}', exOpts: { path: 'b', value: 'x' },
    run: (ctx) => {
      const root = ctx.desc.json();
      setAt(root, parsePath(need(ctx, 'path')), parseValue(need(ctx, 'value')));
      return JSON.stringify(root, null, 2);
    },
  }),
  mk('delete', '修改', '删除 --path 处的键/元素', {
    args: [ARG_PATH],
    inExample: '{"a":1,"b":2}', outExample: '{\n  "a": 1\n}', exOpts: { path: 'b' },
    run: (ctx) => {
      const root = ctx.desc.json();
      delAt(root, parsePath(need(ctx, 'path')));
      return JSON.stringify(root, null, 2);
    },
  }),
  mk('merge', '修改', '深度合并：input 为 JSON 数组，后者覆盖前者', {
    inDesc: 'JSON 数组，元素为待合并的对象',
    inExample: '[{"a":1,"b":{"x":1}},{"b":{"y":2}}]', outExample: '{\n  "a": 1,\n  "b": {\n    "x": 1,\n    "y": 2\n  }\n}',
    run: (ctx) => {
      const arr = ctx.desc.json();
      if (!Array.isArray(arr)) throw new inputError('merge 要求 input 为 JSON 数组');
      const deep = (a, b) => {
        if (Array.isArray(a) && Array.isArray(b)) return b;
        if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
          const out = { ...a };
          for (const k of Object.keys(b)) out[k] = k in out ? deep(out[k], b[k]) : b[k];
          return out;
        }
        return b;
      };
      return JSON.stringify(arr.reduce((acc, cur) => deep(acc, cur), Array.isArray(arr[0]) ? [] : {}), null, 2);
    },
  }),
  mk('flatten', '修改', '扁平化为一层，--sep 键分隔符', {
    args: [{ long: '--sep', default: '.', desc: '键分隔符，默认 "."' }],
    inExample: '{"a":{"b":1}}', outExample: '{\n  "a.b": 1\n}',
    run: (ctx) => {
      const sep = ctx.opts.sep === undefined ? '.' : ctx.opts.sep;
      const out = {};
      const rec = (node, prefix) => {
        if (Array.isArray(node)) {
          if (!node.length) out[prefix] = [];
          node.forEach((v, i) => rec(v, prefix ? `${prefix}${sep}${i}` : String(i)));
        } else if (node && typeof node === "object") {
          if (!Object.keys(node).length) out[prefix] = {};
          for (const k of Object.keys(node)) rec(node[k], prefix ? `${prefix}${sep}${k}` : k);
        } else {
          out[prefix] = node;
        }
      };
      const root = ctx.desc.json();
      if (root === null || typeof root !== "object") out.value = root;
      else rec(root, "");
      return JSON.stringify(out, null, 2);
    },
  }),
  mk('unflatten', '修改', '把扁平键还原为嵌套结构，--sep 键分隔符', {
    args: [{ long: '--sep', default: '.', desc: '键分隔符，默认 "."' }],
    inExample: '{"a.b":1}', outExample: '{\n  "a": {\n    "b": 1\n  }\n}',
    run: (ctx) => {
      const sep = ctx.opts.sep === undefined ? '.' : ctx.opts.sep;
      const src = ctx.desc.json();
      const out = {};
      for (const [k, v] of Object.entries(src)) {
        // 纯数字段视为数组下标，保证 flatten / unflatten 可往返
        setAt(out, k.split(sep).map((s) => (/^-?\d+$/.test(s) ? Number(s) : s)), v);
      }
      return JSON.stringify(out, null, 2);
    },
  }),

  /* ---------- 数组 ---------- */
  mk('select', '数组', '从对象数组中挑选字段，--keys 逗号分隔', {
    args: [{ long: '--keys', desc: '字段名，逗号分隔（必填）' }],
    inDesc: 'JSON 对象数组',
    inExample: '[{"a":1,"b":2},{"a":3,"b":4}]', outExample: '[\n  {\n    "a": 1\n  },\n  {\n    "a": 3\n  }\n]', exOpts: { keys: 'a' },
    run: (ctx) => {
      const arr = ctx.desc.json();
      if (!Array.isArray(arr)) throw new inputError('select 要求 input 为 JSON 数组');
      const keys = String(need(ctx, 'keys')).split(',').map((s) => s.trim()).filter(Boolean);
      return JSON.stringify(arr.map((o) => (o && typeof o === 'object' ? Object.fromEntries(keys.map((k) => [k, o[k]])) : o)), null, 2);
    },
  }),
  mk('sort', '数组', '按 --by 字段排序，--desc 降序，--numeric 数值比较', {
    args: [{ long: '--by', desc: '排序字段路径，缺省按元素本身' }, { long: '--desc', flag: true, desc: '降序' }, { long: '--numeric', flag: true, desc: '按数值比较' }],
    inDesc: 'JSON 数组',
    inExample: '[{"n":3},{"n":1},{"n":2}]', outExample: '[\n  {\n    "n": 1\n  },\n  {\n    "n": 2\n  },\n  {\n    "n": 3\n  }\n]', exOpts: { by: 'n', numeric: true },
    run: (ctx) => {
      const arr = [...ctx.desc.json()];
      if (!Array.isArray(arr)) throw new inputError('sort 要求 input 为 JSON 数组');
      const key = ctx.opts.by;
      const val = (o) => (key ? getAt(o, parsePath(key)) : o);
      arr.sort((a, b) => {
        const va = val(a), vb = val(b);
        let c;
        if (ctx.opts.numeric) c = Number(va) - Number(vb);
        else if (typeof va === 'number' && typeof vb === 'number') c = va - vb;
        else c = String(va).localeCompare(String(vb));
        return ctx.opts.desc ? -c : c;
      });
      return JSON.stringify(arr, null, 2);
    },
  }),
  mk('filter', '数组', '筛选数组元素：--path 取值后与 --value 比较，--op 比较符', {
    args: [ARG_PATH, { long: '--value', desc: '比较值（exists 时不需要）' }, {
      long: '--op', default: 'eq', desc: 'eq|ne|gt|gte|lt|lte|contains|exists|regex',
    }],
    inDesc: 'JSON 数组',
    inExample: '[{"n":1},{"n":5},{"n":9}]', outExample: '[\n  {\n    "n": 5\n  },\n  {\n    "n": 9\n  }\n]', exOpts: { path: 'n', op: 'gte', value: '5' },
    run: (ctx) => {
      const arr = ctx.desc.json();
      if (!Array.isArray(arr)) throw new inputError('filter 要求 input 为 JSON 数组');
      const parts = parsePath(need(ctx, 'path'));
      const op = ctx.opts.op || 'eq';
      const target = parseValue(ctx.opts.value === undefined ? '' : ctx.opts.value);
      const test = (v) => {
        switch (op) {
          case 'exists': return v !== undefined;
          case 'eq': return JSON.stringify(v) === JSON.stringify(target);
          case 'ne': return JSON.stringify(v) !== JSON.stringify(target);
          case 'gt': return Number(v) > Number(target);
          case 'gte': return Number(v) >= Number(target);
          case 'lt': return Number(v) < Number(target);
          case 'lte': return Number(v) <= Number(target);
          case 'contains': return typeof v === 'string' ? v.includes(String(target)) : Array.isArray(v) && v.includes(target);
          case 'regex': return new RegExp(String(target)).test(String(v));
          default: throw new usageError(`不支持的比较符: ${op}`);
        }
      };
      return JSON.stringify(arr.filter((e) => test(getAt(e, parts))), null, 2);
    },
  }),
  mk('pluck', '数组', '抽取数组中每个元素的 --path 值，组成新数组', {
    args: [ARG_PATH], inDesc: 'JSON 数组',
    inExample: '[{"n":1},{"n":2}]', outExample: '[\n  1,\n  2\n]', exOpts: { path: 'n' },
    run: (ctx) => {
      const arr = ctx.desc.json();
      if (!Array.isArray(arr)) throw new inputError('pluck 要求 input 为 JSON 数组');
      const parts = parsePath(need(ctx, 'path'));
      return JSON.stringify(arr.map((e) => getAt(e, parts)), null, 2);
    },
  }),
  mk('reverse', '数组', '反转数组', {
    inDesc: 'JSON 数组', inExample: '[1,2,3]', outExample: '[\n  3,\n  2,\n  1\n]',
    run: (ctx) => {
      const arr = ctx.desc.json();
      if (!Array.isArray(arr)) throw new inputError('reverse 要求 input 为 JSON 数组');
      return JSON.stringify([...arr].reverse(), null, 2);
    },
  }),
  mk('diff', '数组', '比较两个 JSON：input 为长度 2 的数组，输出差异行', {
    inDesc: 'JSON 数组，恰好两个元素',
    outLayout: 'rows', outDesc: '每行一条差异：~ 变更 / - 删除 / + 新增',
    inExample: '[{"a":1,"b":2},{"a":1,"b":3,"c":4}]', outExample: '~ b: 2 -> 3\n+ c: 4',
    run: (ctx) => {
      const arr = ctx.desc.json();
      if (!Array.isArray(arr) || arr.length !== 2) throw new inputError('diff 要求 input 为长度 2 的 JSON 数组');
      const [a, b] = arr;
      const out = [];
      const walk2 = (x, y, p) => {
        if (JSON.stringify(x) === JSON.stringify(y)) return;
        if (x === null || y === null || typeof x !== 'object' || typeof y !== 'object') {
          out.push(`~ ${p}: ${JSON.stringify(x)} -> ${JSON.stringify(y)}`);
          return;
        }
        const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])];
        for (const k of keys) {
          const np = p ? `${p}.${k}` : k;
          if (!(k in x)) out.push(`+ ${np}: ${JSON.stringify(y[k])}`);
          else if (!(k in y)) out.push(`- ${np}: ${JSON.stringify(x[k])}`);
          else walk2(x[k], y[k], np);
        }
      };
      walk2(a, b, '');
      return out.join('\n');
    },
  }),
];

module.exports = {
  name: 'json_tool',
  title: 'JSON 处理工具',
  category: '通用 / 数据',
  summary: '格式化、路径读写、增删改、数组筛选排序、深度合并与差异比较',
  version: require('../../package.json').version,
  functions,
};

