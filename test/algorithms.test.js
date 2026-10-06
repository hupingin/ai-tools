'use strict';

const test = require('node:test');
const assert = require('node:assert');
const num = require('../lib/num');
const colorTool = require('../tools/color_tool');
const unitTool = require('../tools/unit_tool');
const financeTool = require('../tools/finance_tool');

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

test('num: 格式化去掉浮点噪声', () => {
  assert.strictEqual(num.fmt(0.1 + 0.2), '0.3');
  assert.strictEqual(num.fmt(3), '3');
  assert.strictEqual(num.fmt(1 / 3), '0.333333333333');
});

test('num: 数论基础', () => {
  assert.strictEqual(num.gcd(12, 18), 6);
  assert.strictEqual(num.lcm(4, 6), 12);
  assert.strictEqual(num.factorial(5), 120);
  assert.strictEqual(num.fibonacci(10), 55);
  assert.strictEqual(num.isPrime(97), true);
  assert.strictEqual(num.isPrime(91), false);
  assert.deepStrictEqual(num.primeFactors(360), [2, 2, 2, 3, 3, 5]);
});

test('num: 分位数 type-7 插值', () => {
  const s = [1, 2, 3, 4];
  near(num.quantile(s, 0), 1);
  near(num.quantile(s, 0.5), 2.5);
  near(num.quantile(s, 1), 4);
});

test('num.solve: 求 IRR 方程根', () => {
  const cfs = [-1000, 300, 400, 500];
  const f = (r) => cfs.reduce((s, cf, i) => s + cf / Math.pow(1 + r, i), 0);
  const r = num.solve(f, { guess: 0.1 });
  near(r, 0.0889633946933, 1e-6);
});

test('color: HSL 往返与 WCAG 对比度', () => {
  const { _parseColor, _contrastRatio, _luminance } = colorTool;
  assert.deepStrictEqual(_parseColor('#ff0000'), { r: 255, g: 0, b: 0 });
  assert.deepStrictEqual(_parseColor('#f00'), { r: 255, g: 0, b: 0 });
  assert.deepStrictEqual(_parseColor('255 0 0'), { r: 255, g: 0, b: 0 });
  near(_luminance({ r: 255, g: 255, b: 255 }), 1, 1e-12);
  near(_luminance({ r: 0, g: 0, b: 0 }), 0, 1e-12);
  near(_contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }), 21, 1e-9);
});

test('unit: 线性与仿射换算', () => {
  const { _resolve, _toBase, _fromBase } = unitTool;
  const a = _resolve('km');
  const b = _resolve('m');
  near(_toBase(a.catDef, a.unit, 1), 1000);
  near(_fromBase(b.catDef, b.unit, 1000), 1000);

  const catDef = _resolve('C').catDef; // 温度类别（仿射换算）
  near(_fromBase(catDef, 'F', _toBase(catDef, 'C', 100)), 212, 1e-9);
  near(_fromBase(catDef, 'C', _toBase(catDef, 'F', 32)), 0, 1e-9);
  near(_fromBase(catDef, 'K', _toBase(catDef, 'C', 0)), 273.15, 1e-9);

  // 单位消歧
  assert.strictEqual(_resolve('C').cat, 'temperature');
  assert.strictEqual(_resolve('m').cat, 'length');
  assert.strictEqual(_resolve('min').cat, 'time');
  assert.strictEqual(_resolve('c', 'speed').cat, 'speed');
});

test('finance: PMT 与摊销表自洽', () => {
  const pmtFn = financeTool.functions.find((f) => f.name === 'pmt');
  const amortFn = financeTool.functions.find((f) => f.name === 'amortization');
  const descOf = (s) => ({ numbers: () => s.split(/\s+/).map(Number), payload: () => s });
  const ctx = { desc: descOf('100000 0.005 120'), opts: {} };
  const pmt = Number(pmtFn.run(ctx));
  near(pmt, 1110.20501942, 1e-6);

  const amort = amortFn.run(ctx).split('\n');
  assert.strictEqual(amort.length, 120);
  const last = amort[119].split(' ').map(Number);
  near(last[3], 0, 1e-6); // 最后一期余额归零
  const totalPrincipal = amort.reduce((s, l) => s + Number(l.split(' ')[2]), 0);
  near(totalPrincipal, 100000, 1e-4);
});

test('finance: NPV 在 IRR 处为 0', () => {
  const irrFn = financeTool.functions.find((f) => f.name === 'irr');
  const npvFn = financeTool.functions.find((f) => f.name === 'npv');
  const descOf = (s) => ({ numbers: () => s.split(/\s+/).map(Number) });
  const irr = Number(irrFn.run({ desc: descOf('-1000 300 400 500'), opts: {} }));
  const npv = Number(npvFn.run({ desc: descOf(`${irr} -1000 300 400 500`), opts: {} }));
  near(npv, 0, 1e-6);
});
