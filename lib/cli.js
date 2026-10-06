'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { EXIT, ToolError, usageError, inputError, runtimeError, unknownError } = require('./errors');
const { Desc } = require('./desc');
const table = require('./table');

const DEFAULT_INPUT = 'input.desc';
const DEFAULT_OUTPUT = 'output.desc';

const GLOBAL_ARGS = [
  { short: '-i', long: '--input', arg: 'FILE', desc: `输入 .desc 文件，默认 ${DEFAULT_INPUT}；"-" 表示 stdin` },
  { short: '-o', long: '--output', arg: 'FILE', desc: `输出 .desc 文件，默认 ${DEFAULT_OUTPUT}；"-" 表示 stdout` },
  { long: '--sep', arg: 'SEP', desc: '字段分隔符，默认空白符' },
  { long: '--comments', flag: true, desc: '忽略 input.desc 中以 # 开头的行' },
  { long: '--json', flag: true, desc: '元函数(list/help/schema/selftest)以 JSON 输出' },
  { short: '-h', long: '--help', flag: true, desc: '显示帮助' },
  { short: '-v', long: '--version', flag: true, desc: '显示版本' },
];

/* ------------------------------------------------------------------ */
/* 参数解析                                                             */
/* ------------------------------------------------------------------ */

function parseArgv(argv, defs) {
  const opts = {};
  const positional = [];
  for (const d of defs) if (d.default !== undefined) opts[keyOf(d)] = d.default;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { positional.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('-') && a !== '-') {
      const eq = a.indexOf('=');
      let name = a, inline = null;
      if (eq > 0) { name = a.slice(0, eq); inline = a.slice(eq + 1); }
      const d = defs.find((x) => x.short === name || x.long === name);
      if (!d) throw usageError(`未知选项: ${a}`);
      if (d.flag) { opts[keyOf(d)] = true; continue; }
      let v = inline;
      if (v === null) {
        if (i + 1 >= argv.length) throw usageError(`选项 ${name} 缺少取值`);
        v = argv[++i];
      }
      opts[keyOf(d)] = coerce(v, d.type, name);
    } else {
      positional.push(a);
    }
  }
  return { opts, positional };
}

function keyOf(d) {
  return (d.long || d.short).replace(/^--?/, '').replace(/-/g, '_');
}

function coerce(v, type, name) {
  if (type === 'number') {
    const n = Number(v);
    if (!Number.isFinite(n)) throw usageError(`选项 ${name} 需要数字，收到 ${JSON.stringify(v)}`);
    return n;
  }
  if (type === 'bool') return v === 'true' || v === '1' || v === true;
  return v;
}

/* ------------------------------------------------------------------ */
/* IO                                                                  */
/* ------------------------------------------------------------------ */

async function readStdin(binary) {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(Buffer.from(c));
  const buf = Buffer.concat(chunks);
  return binary ? buf : buf.toString('utf8');
}

async function readInput(file, binary, required) {
  if (file === '-') return { data: await readStdin(binary), from: 'stdin' };
  try {
    const data = binary ? await fsp.readFile(file) : await fsp.readFile(file, 'utf8');
    return { data, from: file };
  } catch (e) {
    if (e.code === 'ENOENT') {
      if (!required) return { data: binary ? Buffer.alloc(0) : '', from: null };
      throw inputError(`输入文件不存在: ${file}`, `用 -i 指定 input.desc，或用 "-" 从 stdin 读入`);
    }
    throw runtimeError(`读取 ${file} 失败: ${e.message}`);
  }
}

async function writeOutput(file, data) {
  if (file === '-') {
    process.stdout.write(data);
    return;
  }
  const dir = path.dirname(path.resolve(file));
  await fsp.mkdir(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, file);
}

function normalizeTextResult(r) {
  if (r === undefined || r === null) return '';
  if (Buffer.isBuffer(r)) return r;
  if (typeof r === 'object') return JSON.stringify(r, null, 2) + '\n';
  let s = String(r);
  if (s && !s.endsWith('\n')) s += '\n';
  return s;
}

/* ------------------------------------------------------------------ */
/* 元函数                                                               */
/* ------------------------------------------------------------------ */

const META_NAMES = new Set(['list', 'functions', 'help', 'schema', 'selftest', 'version']);

function fnList(tool, opts) {
  const fns = tool.functions;
  if (opts.json) {
    return JSON.stringify(fns.map((f) => ({
      name: f.name, group: f.group || '', summary: f.summary,
      input: f.input || null, output: f.output || null,
    })), null, 2) + '\n';
  }
  const rows = [['FUNCTION', 'GROUP', 'SUMMARY']];
  for (const f of fns) rows.push([f.name, f.group || '-', f.summary || '']);
  let out = `${tool.name} — ${tool.summary}\n\n用法: ${tool.name} <function> -i ${DEFAULT_INPUT} -o ${DEFAULT_OUTPUT} [选项]\n\n`;
  out += table.render(rows, { header: true }) + '\n';
  out += `\n共 ${fns.length} 个函数。用 \`${tool.name} help <function>\` 查看某个函数的输入输出契约。\n`;
  return out;
}

function fnHelp(tool, name, opts) {
  if (!name) return fnList(tool, opts);
  const f = tool.functions.find((x) => x.name === name);
  if (!f) throw unknownError(`未知函数: ${name}`, `用 \`${tool.name} list\` 查看全部函数`);
  if (opts.json) return JSON.stringify(f, null, 2) + '\n';

  const L = [];
  L.push(`${tool.name} ${f.name} — ${f.summary || ''}`);
  L.push('');
  L.push(`用法: ${tool.name} ${f.name} -i ${DEFAULT_INPUT} -o ${DEFAULT_OUTPUT}${f.args && f.args.length ? ' [选项]' : ''}`);
  L.push('');
  const in_ = f.input || {};
  L.push(`输入 (input.desc):`);
  L.push(`  布局: ${in_.layout || in_.kind || 'values'}${in_.count ? `，共 ${in_.count} 个值` : ''}${in_.min !== undefined ? `，至少 ${in_.min} 个值` : ''}`);
  if (in_.desc) L.push(`  说明: ${in_.desc}`);
  if (in_.example !== undefined) L.push(`  示例: ${JSON.stringify(in_.example)}`);
  L.push('');
  const out_ = f.output || {};
  L.push(`输出 (output.desc):`);
  L.push(`  布局: ${out_.layout || 'text'}`);
  if (out_.desc) L.push(`  说明: ${out_.desc}`);
  if (out_.example !== undefined) L.push(`  示例: ${JSON.stringify(out_.example)}`);
  if (f.args && f.args.length) {
    L.push('');
    L.push('选项:');
    const rows = [['FLAG', 'ARG', 'DEFAULT', 'DESC']];
    for (const a of f.args) {
      rows.push([`${a.short ? a.short + ', ' : ''}${a.long}`, a.flag ? '' : (a.arg || 'VAL'), a.default === undefined ? '' : String(a.default), a.desc || '']);
    }
    L.push(table.render(rows).split('\n').map((l) => '  ' + l).join('\n'));
  }
  if (f.examples && f.examples.length) {
    L.push('');
    L.push('示例:');
    for (const ex of f.examples) {
      const inPart = ex.input === undefined ? '(无输入)' : `input.desc = ${JSON.stringify(ex.input)}`;
      const optPart = ex.opts ? ' ' + Object.entries(ex.opts).map(([k, v]) => `--${k} ${v}`).join(' ') : '';
      L.push(`  ${inPart}${optPart}`);
      L.push(`  => ${JSON.stringify(ex.expect)}`);
    }
  }
  L.push('');
  return L.join('\n');
}

function fnSchema(tool, name) {
  const payload = {
    spec: 'DESC/1.0',
    tool: tool.name,
    title: tool.title || tool.name,
    category: tool.category || 'general',
    summary: tool.summary || '',
    version: tool.version || '0.0.0',
    usage: `${tool.name} <function> -i ${DEFAULT_INPUT} -o ${DEFAULT_OUTPUT} [options]`,
    inputFile: { default: DEFAULT_INPUT, flag: '-i/--input', encoding: 'utf-8', format: 'DESC/1.0 裸数据' },
    outputFile: { default: DEFAULT_OUTPUT, flag: '-o/--output', encoding: 'utf-8', format: 'DESC/1.0 裸数据' },
    exitCodes: EXIT,
    functions: (name ? tool.functions.filter((f) => f.name === name) : tool.functions).map((f) => ({
      name: f.name,
      group: f.group || '',
      summary: f.summary || '',
      input: f.input || null,
      output: f.output || null,
      args: f.args || [],
      examples: f.examples || [],
    })),
  };
  if (name && payload.functions.length === 0) throw unknownError(`未知函数: ${name}`);
  return JSON.stringify(payload, null, 2) + '\n';
}

/* ------------------------------------------------------------------ */
/* selftest                                                            */
/* ------------------------------------------------------------------ */

function norm(s) {
  return String(s === undefined || s === null ? '' : s).replace(/\r\n/g, '\n').trim();
}

function compareOutput(actual, expect) {
  const a = norm(actual);
  const e = norm(expect);
  if (a === e) return true;
  const at = a.split(/\s+/).filter(Boolean);
  const et = e.split(/\s+/).filter(Boolean);
  if (at.length && at.length === et.length) {
    const an = at.map(Number);
    const en = et.map(Number);
    if (an.every(Number.isFinite) && en.every(Number.isFinite)) {
      return an.every((v, i) => Math.abs(v - en[i]) <= 1e-6 * Math.max(1, Math.abs(en[i])));
    }
  }
  return false;
}

async function fnSelftest(tool, opts) {
  const results = [];
  for (const f of tool.functions) {
    if (!f.examples || !f.examples.length) continue;
    for (let i = 0; i < f.examples.length; i++) {
      const ex = f.examples[i];
      let ok = false, actual = '', err = null;
      try {
        const desc = new Desc(ex.input === undefined ? '' : ex.input, {
          sep: (ex.opts && ex.opts.sep) || null,
          comments: !!(ex.opts && ex.opts.comments),
        });
        const ctx = {
          desc,
          opts: { ...(f.args || []).reduce((m, a) => { if (a.default !== undefined) m[keyOf(a)] = a.default; return m; }, {}), ...(ex.opts || {}) },
          positional: ex.positional || [],
          sep: (ex.opts && ex.opts.sep) || null,
          buf: null,
          inPath: null,
          tool, fn: f,
        };
        const r = await f.run(ctx);
        actual = Buffer.isBuffer(r) ? `<binary ${r.length}B>` : norm(r);
        ok = compareOutput(actual, ex.expect);
      } catch (e) {
        err = e instanceof ToolError ? e.format() : e.message;
      }
      results.push({ fn: f.name, i, ok, expect: ex.expect, actual, err });
    }
  }
  if (opts.json) {
    return JSON.stringify({
      tool: tool.name,
      total: results.length,
      passed: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      cases: results,
    }, null, 2) + '\n';
  }
  const lines = [`selftest: ${tool.name}`];
  for (const r of results) {
    if (r.ok) {
      lines.push(`  PASS  ${r.fn}#${r.i}`);
    } else {
      lines.push(`  FAIL  ${r.fn}#${r.i}`);
      lines.push(`        expect: ${JSON.stringify(norm(r.expect))}`);
      lines.push(`        actual: ${JSON.stringify(norm(r.actual))}`);
      if (r.err) lines.push(`        error : ${r.err}`);
    }
  }
  const passed = results.filter((r) => r.ok).length;
  lines.push('');
  lines.push(`${passed}/${results.length} passed`);
  return lines.join('\n') + '\n';
}

/* ------------------------------------------------------------------ */
/* 主入口                                                               */
/* ------------------------------------------------------------------ */

/**
 * 运行一个工具。
 * @param {object} tool { name, title, category, summary, version, functions }
 * @param {string[]} argv process.argv.slice(2)
 * @returns {Promise<number>} 退出码
 */
/** 每个工具自动拥有的元函数，AI 可据此自发现契约 */
function metaFunctions(tool) {
  const v = `${tool.name} ${tool.version || '0.0.0'}\n`;
  return [
    {
      name: 'list', group: 'meta', summary: '列出本工具全部函数',
      input: { kind: 'none', layout: '(无需 input.desc)' },
      output: { layout: 'text', desc: '函数清单表格；--json 时为 JSON 数组' },
      run: (ctx) => fnList(tool, ctx.opts),
    },
    {
      name: 'functions', group: 'meta', summary: 'list 的别名',
      input: { kind: 'none' }, output: { layout: 'text' },
      run: (ctx) => fnList(tool, ctx.opts),
    },
    {
      name: 'help', group: 'meta', summary: '查看某个函数的输入输出契约',
      args: [{ short: '-f', long: '--fn', arg: 'NAME', desc: '要查看的函数名，也可作为位置参数' }],
      input: { kind: 'none' }, output: { layout: 'text' },
      run: (ctx) => fnHelp(tool, ctx.opts.fn || ctx.positional[0], ctx.opts),
    },
    {
      name: 'schema', group: 'meta', summary: '输出机器可读的 JSON 契约（供 AI 直接消费）',
      args: [{ short: '-f', long: '--fn', arg: 'NAME', desc: '只输出该函数的契约' }],
      input: { kind: 'none' }, output: { layout: 'json' },
      run: (ctx) => fnSchema(tool, ctx.opts.fn || ctx.positional[0]),
    },
    {
      name: 'selftest', group: 'meta', summary: '运行内置示例并校验输出',
      input: { kind: 'none' }, output: { layout: 'text' },
      run: (ctx) => fnSelftest(tool, ctx.opts),
    },
    {
      name: 'version', group: 'meta', summary: '输出版本号',
      input: { kind: 'none' }, output: { layout: 'text' },
      run: () => v,
    },
  ];
}

async function run(tool, argv) {
  // 元函数名是保留字，始终优先命中，保证 AI 一定能自发现契约
  const all = [...metaFunctions(tool), ...tool.functions];
  const scoped = { ...tool, functions: all };
  const name = argv[0];
  const rest = argv.slice(1);

  // 无函数名 / 全局 -h / -v
  if (!name || name === '-h' || name === '--help') {
    if (!name) process.stderr.write(`${tool.name}: 缺少函数名\n\n`);
    process.stdout.write(fnList(scoped, {}));
    return name ? EXIT.OK : EXIT.USAGE;
  }
  if (name === '-v' || name === '--version') {
    process.stdout.write(`${tool.name} ${tool.version || '0.0.0'}\n`);
    return EXIT.OK;
  }

  const fn = all.find((f) => f.name === name);
  if (!fn) {
    process.stderr.write(new ToolError('UNKNOWN', `未知函数: ${name}`, `用 \`${tool.name} list\` 查看全部函数`).format() + '\n');
    return EXIT.UNKNOWN;
  }

  try {
    const defs = [...GLOBAL_ARGS, ...(fn.args || [])];
    const { opts, positional } = parseArgv(rest, defs);

    const inFile = opts.input || DEFAULT_INPUT;
    const outFile = opts.output || DEFAULT_OUTPUT;

    const kind = (fn.input && fn.input.kind) || 'values';
    const needInput = kind !== 'none';
    const binary = !!(fn.input && fn.input.binary);

    const { data, from } = needInput
      ? await readInput(inFile, binary, fn.input && fn.input.required !== false)
      : { data: binary ? Buffer.alloc(0) : '', from: null };

    // 二进制模式下仍按 UTF-8 构建 Desc，便于"第 1 行是路径"这类混合契约
    const desc = new Desc(binary ? data.toString('utf8') : data, {
      sep: opts.sep || null,
      comments: !!opts.comments,
    });

    const ctx = {
      desc, buf: binary ? data : null, inPath: from,
      opts, positional, sep: opts.sep || null,
      tool: scoped, fn, outFile,
    };

    const result = await fn.run(ctx);
    const payload = Buffer.isBuffer(result) ? result : normalizeTextResult(result);

    // 元函数默认走 stdout；显式 -o 时写文件
    if (META_NAMES.has(name) && !opts.output) {
      process.stdout.write(payload);
    } else {
      await writeOutput(outFile, payload);
    }
    return EXIT.OK;
  } catch (e) {
    const te = e instanceof ToolError ? e : runtimeError(e && e.message ? e.message : String(e));
    process.stderr.write(te.format() + '\n');
    return te.exitCode;
  }
}

/** bin/*.js 的通用 bootstrap */
function main(tool) {
  run(tool, process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  }).catch((e) => {
    process.stderr.write(`${e && e.stack ? e.stack : e}\n`);
    process.exitCode = EXIT.RUNTIME;
  });
}

module.exports = {
  run, main, parseArgv, readInput, writeOutput,
  fnList, fnHelp, fnSchema, fnSelftest, compareOutput,
  META_NAMES, DEFAULT_INPUT, DEFAULT_OUTPUT, GLOBAL_ARGS,
};
