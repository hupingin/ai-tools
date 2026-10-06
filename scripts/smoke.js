#!/usr/bin/env node
'use strict';

/**
 * 端到端冒烟：驱动真实的 CLI 引擎（lib/cli.run），验证 README 里的第一个例子。
 * 不依赖子进程，方便在受限环境中执行。
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');
const { run } = require('../lib/cli');
const registry = require('../registry');

const root = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-smoke-'));

/** 捕获 stdout/stderr，返回 { code, out, err } */
async function invoke(toolName, argv) {
  const out = [];
  const err = [];
  const so = process.stdout.write.bind(process.stdout);
  const se = process.stderr.write.bind(process.stderr);
  process.stdout.write = (s) => { out.push(String(s)); return true; };
  process.stderr.write = (s) => { err.push(String(s)); return true; };
  try {
    const code = await run(registry.load(toolName), argv);
    return { code, out: out.join(''), err: err.join('') };
  } finally {
    process.stdout.write = so;
    process.stderr.write = se;
  }
}

/** 以文件为输入输出的调用，返回 output 文件内容 */
async function callWithFiles(toolName, fn, inputText, opts = {}) {
  const dir = fs.mkdtempSync(path.join(tmp, 'case-'));
  const inPath = path.join(dir, 'input.desc');
  const outPath = path.join(dir, 'output.desc');
  if (inputText !== null) fs.writeFileSync(inPath, inputText);
  const argv = [fn, '-i', inPath, '-o', outPath, ...(opts.argv || [])];
  const r = await invoke(toolName, argv);
  return { ...r, text: fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null, dir };
}

/** 以 stdin/stdout 为输入输出的调用 */
async function callStdio(toolName, fn, inputText, opts = {}) {
  return invoke(toolName, [fn, '-i', '-', '-o', '-', ...(opts.argv || [])]);
}

let n = 0;
const ok = (msg) => { n++; process.stdout.write(`  ok  ${msg}\n`); };

(async () => {
  // 1. README 的第一个例子
  {
    const r = await callWithFiles('basic_math_tool', 'add', '1 2');
    assert.strictEqual(r.code, 0, r.err);
    assert.strictEqual(r.text, '3\n');
    ok('basic_math_tool add: input.desc "1 2" -> output.desc "3"');
  }

  // 2. 默认值：省略 -i/-o 时使用当前目录的 input.desc / output.desc
  {
    const cwd0 = process.cwd();
    const dir = fs.mkdtempSync(path.join(tmp, 'cwd-'));
    fs.writeFileSync(path.join(dir, 'input.desc'), '1 2');
    try {
      process.chdir(dir);
      const code = await invoke('basic_math_tool', ['add']).then((r) => r.code);
      assert.strictEqual(code, 0);
      assert.strictEqual(fs.readFileSync(path.join(dir, 'output.desc'), 'utf8'), '3\n');
      ok('默认读写当前目录的 input.desc / output.desc');
    } finally {
      process.chdir(cwd0);
    }
  }

  // 3. 换行分隔等价
  {
    const r = await callWithFiles('basic_math_tool', 'add', '1\n2');
    assert.strictEqual(r.text, '3\n');
    const r2 = await callWithFiles('basic_math_tool', 'sum', '1 2 3 4');
    assert.strictEqual(r2.text, '10\n');
    ok('换行/空格分隔等价，且支持任意个数值');
  }

  // 4. 自发现：list / schema / help
  {
    const r = await invoke('basic_math_tool', ['list']);
    assert.strictEqual(r.code, 0);
    assert.ok(r.out.includes('add'), 'list 应包含 add');
    ok('list 输出函数清单');

    const s = await invoke('basic_math_tool', ['schema', '--fn', 'add']);
    const schema = JSON.parse(s.out);
    assert.strictEqual(schema.functions[0].name, 'add');
    assert.strictEqual(schema.functions[0].input.example, '1 2');
    ok('schema 输出机器可读契约');

    const h = await invoke('basic_math_tool', ['help', 'add']);
    assert.ok(h.out.includes('input.desc'));
    ok('help 输出输入输出契约');
  }

  // 5. 退出码
  {
    const a = await invoke('basic_math_tool', ['no_such_fn', '-i', '-', '-o', '-']);
    assert.strictEqual(a.code, 4);
    ok('未知函数 -> 退出码 4');

    const b = await callWithFiles('basic_math_tool', 'add', null);
    assert.strictEqual(b.code, 2);
    ok('输入文件缺失 -> 退出码 2');

    const c = await invoke('basic_math_tool', ['add', '-i', '-', '-o', '-', '--bogus']);
    assert.strictEqual(c.code, 1);
    ok('未知选项 -> 退出码 1');

    const d = await callWithFiles('basic_math_tool', 'add', '1 abc');
    assert.strictEqual(d.code, 2);
    ok('输入不是数字 -> 退出码 2');

    const e = await callWithFiles('basic_math_tool', 'add', '1');
    assert.strictEqual(e.code, 2);
    ok('数值个数不符 -> 退出码 2');
  }

  // 6. 跨工具抽样
  {
    const u = await callWithFiles('unit_tool', 'convert', '100 km m');
    assert.strictEqual(u.text, '100000\n');
    const c = await callWithFiles('color_tool', 'parse', '#f00');
    assert.strictEqual(c.text, '#ff0000\n');
    const t = await callWithFiles('text_tool', 'upper', 'hello');
    assert.strictEqual(t.text, 'HELLO\n');
    const j = await callWithFiles('json_tool', 'get', '{"a":{"b":42}}', { argv: ['--path', 'a.b'] });
    assert.strictEqual(j.text, '42\n');
    ok('unit/color/text/json 抽样通过');
  }

  // 7. 元函数优先级：工具的 list 不被业务函数劫持
  {
    const r = await invoke('file_tool', ['list']);
    assert.strictEqual(r.code, 0);
    assert.ok(r.out.includes('FUNCTION'), 'file_tool list 应输出函数清单而非列目录');
    ok('元函数名保留，优先于同名业务函数');
  }

  // 8. 总入口注册表
  {
    assert.ok(registry.TOOLS.length >= 12);
    for (const name of registry.TOOLS) {
      const t = registry.load(name);
      assert.ok(t.functions.length > 0, `${name} 没有函数`);
    }
    ok(`registry 含 ${registry.TOOLS.length} 个工具且均可加载`);
  }

  process.stdout.write(`\nsmoke: ${n} 项全部通过\n`);
  fs.rmSync(tmp, { recursive: true, force: true });
})().catch((e) => {
  process.stderr.write(`smoke 失败: ${e && e.stack ? e.stack : e}\n`);
  process.exitCode = 1;
});
