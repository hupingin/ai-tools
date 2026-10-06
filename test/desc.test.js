'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { Desc } = require('../lib/desc');

test('tokens: 空格与换行等价', () => {
  assert.deepStrictEqual(new Desc('1 2').tokens(), ['1', '2']);
  assert.deepStrictEqual(new Desc('1\n2').tokens(), ['1', '2']);
  assert.deepStrictEqual(new Desc('1\t2  3').tokens(), ['1', '2', '3']);
});

test('tokens: 自定义分隔符', () => {
  assert.deepStrictEqual(new Desc('a, b ,c').tokens(','), ['a', 'b', 'c']);
});

test('numbers: 基本解析与数量校验', () => {
  assert.deepStrictEqual(new Desc('1 2').numbers(), [1, 2]);
  assert.deepStrictEqual(new Desc('-1.5 2e3').numbers(), [-1.5, 2000]);
  assert.deepStrictEqual(new Desc('1 2').numbers({ count: 2 }), [1, 2]);
  assert.throws(() => new Desc('1 2 3').numbers({ count: 2 }), (e) => e.code === 'INPUT');
  assert.throws(() => new Desc('1 abc').numbers(), (e) => e.code === 'INPUT');
  assert.throws(() => new Desc('').numbers(), (e) => e.code === 'INPUT');
  assert.deepStrictEqual(new Desc('1 2 3').numbers({ min: 1 }), [1, 2, 3]);
});

test('lines: 默认去空行并 trim', () => {
  assert.deepStrictEqual(new Desc('a\n\nb  ').lines(), ['a', 'b']);
  assert.deepStrictEqual(new Desc('a\n\nb').lines({ keepEmpty: true }), ['a', '', 'b']);
  assert.deepStrictEqual(new Desc('  a  ').lines({ trim: false }), ['  a  ']);
});

test('comments: 默认不剥离，显式开启才剥离', () => {
  assert.deepStrictEqual(new Desc('# note\n1 2').lines(), ['# note', '1 2']);
  assert.deepStrictEqual(new Desc('# note\n1 2', { comments: true }).lines(), ['1 2']);
});

test('payload: 只去掉末尾一个换行，保留其余空白', () => {
  assert.strictEqual(new Desc('hello\n').payload(), 'hello');
  assert.strictEqual(new Desc('hello\n\n').payload(), 'hello\n');
  assert.strictEqual(new Desc('  hi  ').payload(), '  hi  ');
});

test('kv 与 json', () => {
  assert.deepStrictEqual(new Desc('a: 1\nb: 2').kv(), { a: '1', b: '2' });
  assert.deepStrictEqual(new Desc('a = 1').kv(), { a: '1' });
  assert.deepStrictEqual(new Desc('{"a":[1,2]}').json(), { a: [1, 2] });
  assert.throws(() => new Desc('{oops').json(), (e) => e.code === 'INPUT');
});

test('CRLF 归一化', () => {
  assert.strictEqual(new Desc('a\r\nb').text, 'a\nb');
  assert.deepStrictEqual(new Desc('1\r\n2').numbers(), [1, 2]);
});
