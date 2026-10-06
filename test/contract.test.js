'use strict';

const test = require('node:test');
const assert = require('node:assert');
const registry = require('../registry');
const { META_NAMES, fnSelftest } = require('../lib/cli');

const tools = registry.loadAll();

test('工具清单：12 个且命名以 _tool 结尾', () => {
  assert.strictEqual(tools.length, 12);
  for (const t of tools) {
    assert.ok(t.name.endsWith('_tool'), `${t.name} 未以 _tool 结尾`);
    assert.ok(t.title && t.category && t.summary, `${t.name} 缺少 title/category/summary`);
    assert.ok(Array.isArray(t.functions) && t.functions.length > 0, `${t.name} 没有函数`);
  }
});

test('函数契约：名称唯一、不占用元函数保留名、字段齐全', () => {
  for (const t of tools) {
    const seen = new Set();
    for (const f of t.functions) {
      assert.ok(f.name, `${t.name} 有函数缺少 name`);
      assert.ok(!seen.has(f.name), `${t.name}.${f.name} 重复定义`);
      seen.add(f.name);
      assert.ok(!META_NAMES.has(f.name), `${t.name}.${f.name} 使用了保留的元函数名`);
      assert.ok(f.summary, `${t.name}.${f.name} 缺少 summary`);
      assert.ok(f.group, `${t.name}.${f.name} 缺少 group`);
      assert.ok(f.input, `${t.name}.${f.name} 缺少 input 契约`);
      assert.ok(f.output, `${t.name}.${f.name} 缺少 output 契约`);
      assert.strictEqual(typeof f.run, 'function', `${t.name}.${f.run} 缺少 run`);
    }
  }
});

test('每个函数都能被 schema 序列化', () => {
  const { fnSchema } = require('../lib/cli');
  for (const t of tools) {
    const s = JSON.parse(fnSchema(t));
    assert.strictEqual(s.tool, t.name);
    assert.strictEqual(s.functions.length, t.functions.length);
  }
});

test('全部内置示例通过自检', async () => {
  for (const t of tools) {
    const r = JSON.parse(await fnSelftest(t, { json: true }));
    const detail = r.cases.filter((c) => !c.ok)
      .map((c) => `${c.fn}#${c.i} expect=${JSON.stringify(c.expect)} actual=${JSON.stringify(c.actual)} ${c.err || ''}`)
      .join('\n');
    assert.strictEqual(r.failed, 0, `${t.name} 自检失败:\n${detail}`);
  }
});

test('registry.load 拒绝未知工具', () => {
  assert.throws(() => registry.load('nope_tool'), /未知工具/);
});
