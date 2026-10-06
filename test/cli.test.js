'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, parseArgv, compareOutput, fnSchema, fnSelftest } = require('../lib/cli');

const tool = require('../tools/basic_math_tool');

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-test-'));
}

async function invoke(argv, cwd) {
  const out = [];
  const err = [];
  const so = process.stdout.write.bind(process.stdout);
  const se = process.stderr.write.bind(process.stderr);
  process.stdout.write = (s) => { out.push(String(s)); return true; };
  process.stderr.write = (s) => { err.push(String(s)); return true; };
  try {
    const code = await run(tool, argv);
    return { code, out: out.join(''), err: err.join('') };
  } finally {
    process.stdout.write = so;
    process.stderr.write = se;
    if (cwd) process.chdir(path.resolve(cwd, '..'));
  }
}

test('parseArgv: 长短选项、等号写法、flag、位置参数', () => {
  const defs = [
    { short: '-i', long: '--input', arg: 'FILE', desc: '' },
    { long: '--json', flag: true, desc: '' },
    { short: '-n', long: '--n', type: 'number', default: 3, desc: '' },
  ];
  let r = parseArgv(['-i', 'a.desc'], defs);
  assert.strictEqual(r.opts.input, 'a.desc');
  assert.strictEqual(r.opts.n, 3);

  r = parseArgv(['--input=a.desc', '--json', 'x', 'y'], defs);
  assert.strictEqual(r.opts.input, 'a.desc');
  assert.strictEqual(r.opts.json, true);
  assert.deepStrictEqual(r.positional, ['x', 'y']);

  r = parseArgv(['--n', '7'], defs);
  assert.strictEqual(r.opts.n, 7);

  assert.throws(() => parseArgv(['--zzz'], defs), (e) => e.code === 'USAGE');
  assert.throws(() => parseArgv(['--n', 'abc'], defs), (e) => e.code === 'USAGE');
  assert.throws(() => parseArgv(['-i'], defs), (e) => e.code === 'USAGE');
});

test('run: 写入 output.desc', async () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'input.desc'), '1 2');
  const code = await run(tool, ['add', '-i', path.join(dir, 'input.desc'), '-o', path.join(dir, 'output.desc')]);
  assert.strictEqual(code, 0);
  assert.strictEqual(fs.readFileSync(path.join(dir, 'output.desc'), 'utf8'), '3\n');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('run: 自动创建输出目录', async () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'input.desc'), '1 2');
  const out = path.join(dir, 'nested', 'deep', 'output.desc');
  const code = await run(tool, ['add', '-i', path.join(dir, 'input.desc'), '-o', out]);
  assert.strictEqual(code, 0);
  assert.strictEqual(fs.readFileSync(out, 'utf8'), '3\n');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('run: 退出码', async () => {
  assert.strictEqual((await invoke(['nope'])).code, 4);
  assert.strictEqual((await invoke(['add', '-i', '-', '-o', '-', '--zzz'])).code, 1);
});

test('run: 无函数名时打印清单并返回 USAGE', async () => {
  const r = await invoke([]);
  assert.strictEqual(r.code, 1);
  assert.ok(r.out.includes('FUNCTION'));
});

test('元函数: list/help/schema/selftest/version', async () => {
  const list = await invoke(['list']);
  assert.strictEqual(list.code, 0);
  assert.ok(list.out.includes('add'));

  const help = await invoke(['help', 'add']);
  assert.ok(help.out.includes('input.desc'));

  const schema = JSON.parse((await invoke(['schema', '--fn', 'add'])).out);
  assert.strictEqual(schema.tool, 'basic_math_tool');
  assert.strictEqual(schema.functions[0].name, 'add');

  const version = await invoke(['version']);
  assert.ok(version.out.startsWith('basic_math_tool '));

  const st = await invoke(['selftest']);
  assert.strictEqual(st.code, 0);
  assert.ok(st.out.includes('passed'));
});

test('fnSchema 可被 JSON 序列化且含退出码表', () => {
  const s = JSON.parse(fnSchema(tool));
  assert.strictEqual(s.exitCodes.OK, 0);
  assert.strictEqual(s.exitCodes.UNKNOWN, 4);
  assert.ok(s.functions.length > 20);
});

test('compareOutput: 数值容差与字符串精确', () => {
  assert.ok(compareOutput('3\n', '3'));
  assert.ok(compareOutput('0.30000000000000004', '0.3'));
  assert.ok(compareOutput('1 2 3', '1 2 3'));
  assert.ok(!compareOutput('1 2 3', '1 2 4'));
  assert.ok(!compareOutput('abc', 'abd'));
});

test('fnSelftest: 全部内置示例通过', async () => {
  const r = JSON.parse(await fnSelftest(tool, { json: true }));
  assert.strictEqual(r.failed, 0);
  assert.ok(r.total > 0);
});
