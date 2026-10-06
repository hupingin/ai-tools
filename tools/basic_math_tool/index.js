'use strict';

const { fmt, round, factorial, gcd, lcm, isPrime, primeFactors, fibonacci } = require('../../lib/num');

const TOOL = 'basic_math_tool';

/**
 * 一元/多元数值函数的工厂，保证所有函数拥有一致的 input/output 契约。
 */
function op(name, group, summary, o) {
  const {
    count, min, run, outDesc = '计算结果', outLayout = 'number',
    inExample, outExample, args = [], desc,
  } = o;
  const constraint = count !== undefined ? { count } : { min };
  const fn = {
    name,
    group,
    summary,
    args,
    input: {
      kind: 'values',
      layout: 'values',
      ...constraint,
      desc: desc || (count !== undefined ? `${count} 个数字，空白或换行分隔` : '若干数字，空白或换行分隔'),
      example: inExample,
    },
    output: { layout: outLayout, desc: outDesc, example: outExample },
    examples: [],
    run: (ctx) => {
      const nums = ctx.desc.numbers(constraint);
      return run(nums, ctx);
    },
  };
  if (inExample !== undefined && outExample !== undefined) {
    fn.examples.push({ input: String(inExample), expect: String(outExample) });
  }
  return fn;
}

/** 单值函数 */
function unary(name, group, summary, f, o = {}) {
  return op(name, group, summary, {
    count: 1,
    run: (n) => f(n[0], o),
    inExample: o.inExample !== undefined ? o.inExample : 4,
    outExample: o.outExample,
    args: o.args || [],
    desc: o.desc,
    outDesc: o.outDesc,
    outLayout: o.outLayout,
  });
}

const DEG = { short: '-d', long: '--deg', flag: true, desc: '输入/输出按角度(degree)而非弧度处理' };

const functions = [
  /* ---------- 算术 ---------- */
  op('add', '算术', '两数相加', { count: 2, run: ([a, b]) => a + b, inExample: '1 2', outExample: 3, desc: '两个数字：a b' }),
  op('sub', '算术', '两数相减 (a - b)', { count: 2, run: ([a, b]) => a - b, inExample: '5 3', outExample: 2 }),
  op('mul', '算术', '两数相乘', { count: 2, run: ([a, b]) => a * b, inExample: '6 7', outExample: 42 }),
  op('div', '算术', '两数相除 (a / b)', { count: 2, run: ([a, b]) => a / b, inExample: '10 4', outExample: 2.5 }),
  op('mod', '算术', '取余 (a % b)', { count: 2, run: ([a, b]) => a % b, inExample: '17 5', outExample: 2 }),
  op('pow', '算术', '幂 (a ^ b)', { count: 2, run: ([a, b]) => Math.pow(a, b), inExample: '2 10', outExample: 1024 }),
  op('neg', '算术', '取负', { count: 1, run: ([a]) => -a, inExample: '8', outExample: -8 }),
  op('abs', '算术', '绝对值', { count: 1, run: ([a]) => Math.abs(a), inExample: '-3.5', outExample: 3.5 }),
  op('sum', '算术', '求和（任意个数）', { min: 1, run: (a) => a.reduce((s, v) => s + v, 0), inExample: '1 2 3 4', outExample: 10 }),
  op('product', '算术', '连乘（任意个数）', { min: 1, run: (a) => a.reduce((s, v) => s * v, 1), inExample: '2 3 4', outExample: 24 }),

  /* ---------- 取整 ---------- */
  op('floor', '取整', '向下取整', { count: 1, run: ([a]) => Math.floor(a), inExample: '3.7', outExample: 3 }),
  op('ceil', '取整', '向上取整', { count: 1, run: ([a]) => Math.ceil(a), inExample: '3.2', outExample: 4 }),
  op('trunc', '取整', '截断小数', { count: 1, run: ([a]) => Math.trunc(a), inExample: '-3.7', outExample: -3 }),
  op('round', '取整', '四舍五入，--digits 指定小数位', {
    count: 1,
    args: [{ short: '-n', long: '--digits', type: 'number', default: 0, desc: '保留小数位，默认 0' }],
    run: ([a], ctx) => round(a, ctx.opts.digits || 0),
    inExample: '3.14159', outExample: 3,
  }),

  /* ---------- 比较 ---------- */
  op('min', '比较', '最小值（任意个数）', { min: 1, run: (a) => Math.min(...a), inExample: '4 1 9 2', outExample: 1 }),
  op('max', '比较', '最大值（任意个数）', { min: 1, run: (a) => Math.max(...a), inExample: '4 1 9 2', outExample: 9 }),
  op('clamp', '比较', '区间截断 (x, lo, hi)', { count: 3, run: ([x, lo, hi]) => Math.min(Math.max(x, lo), hi), inExample: '15 0 10', outExample: 10, desc: '三个数字：x lo hi' }),

  /* ---------- 指数对数 ---------- */
  op('sqrt', '指数对数', '平方根', { count: 1, run: ([a]) => Math.sqrt(a), inExample: '16', outExample: 4 }),
  op('cbrt', '指数对数', '立方根', { count: 1, run: ([a]) => Math.cbrt(a), inExample: '27', outExample: 3 }),
  op('exp', '指数对数', 'e 的 x 次方', { count: 1, run: ([a]) => Math.exp(a), inExample: '1', outExample: 2.718281828459 }),
  op('ln', '指数对数', '自然对数', { count: 1, run: ([a]) => Math.log(a), inExample: '1', outExample: 0 }),
  op('log10', '指数对数', '常用对数', { count: 1, run: ([a]) => Math.log10(a), inExample: '100', outExample: 2 }),
  op('log', '指数对数', '以 b 为底的对数 (x, b)', { count: 2, run: ([x, b]) => Math.log(x) / Math.log(b), inExample: '8 2', outExample: 3, desc: '两个数字：真数 底数' }),

  /* ---------- 三角 ---------- */
  op('sin', '三角', '正弦，--deg 使用角度', { count: 1, args: [DEG], run: ([a], ctx) => ctx.opts.deg ? Math.sin(a * Math.PI / 180) : Math.sin(a), inExample: '0', outExample: 0 }),
  op('cos', '三角', '余弦，--deg 使用角度', { count: 1, args: [DEG], run: ([a], ctx) => ctx.opts.deg ? Math.cos(a * Math.PI / 180) : Math.cos(a), inExample: '0', outExample: 1 }),
  op('tan', '三角', '正切，--deg 使用角度', { count: 1, args: [DEG], run: ([a], ctx) => ctx.opts.deg ? Math.tan(a * Math.PI / 180) : Math.tan(a), inExample: '0', outExample: 0 }),
  op('asin', '三角', '反正弦，--deg 输出角度', { count: 1, args: [DEG], run: ([a], ctx) => ctx.opts.deg ? Math.asin(a) * 180 / Math.PI : Math.asin(a), inExample: '0', outExample: 0 }),
  op('acos', '三角', '反余弦，--deg 输出角度', { count: 1, args: [DEG], run: ([a], ctx) => ctx.opts.deg ? Math.acos(a) * 180 / Math.PI : Math.acos(a), inExample: '1', outExample: 0 }),
  op('atan', '三角', '反正切，--deg 输出角度', { count: 1, args: [DEG], run: ([a], ctx) => ctx.opts.deg ? Math.atan(a) * 180 / Math.PI : Math.atan(a), inExample: '0', outExample: 0 }),
  op('atan2', '三角', '四象限反正切 (y, x)，--deg 输出角度', { count: 2, args: [DEG], run: ([y, x], ctx) => ctx.opts.deg ? Math.atan2(y, x) * 180 / Math.PI : Math.atan2(y, x), inExample: '1 1', outExample: 0.785398163397 }),
  op('hypot', '三角', '欧氏距离 sqrt(x^2+y^2)（任意个数）', { min: 1, run: (a) => Math.hypot(...a), inExample: '3 4', outExample: 5 }),

  /* ---------- 数论 ---------- */
  op('gcd', '数论', '最大公约数（任意个数）', { min: 2, run: (a) => a.reduce((g, v) => gcd(g, v)), inExample: '12 18', outExample: 6 }),
  op('lcm', '数论', '最小公倍数（任意个数）', { min: 2, run: (a) => a.reduce((g, v) => lcm(g, v)), inExample: '4 6', outExample: 12 }),
  op('factorial', '数论', '阶乘 n!', { count: 1, run: ([a]) => factorial(a), inExample: '5', outExample: 120 }),
  op('fibonacci', '数论', '第 n 个斐波那契数 (F(0)=0)', { count: 1, run: ([a]) => fibonacci(a), inExample: '10', outExample: 55 }),
  op('is_prime', '数论', '素数判定，输出 true/false', {
    count: 1, outLayout: 'boolean',
    run: ([a]) => isPrime(a), inExample: '97', outExample: 'true',
  }),
  op('prime_factors', '数论', '质因数分解，输出空白分隔的质因数', {
    count: 1, outLayout: 'values',
    run: ([a]) => primeFactors(a).join(' '), inExample: '360', outExample: '2 2 2 3 3 5',
  }),
  op('next_prime', '数论', '大于等于 n 的最小素数', {
    count: 1,
    run: ([a]) => { let n = Math.max(2, Math.ceil(a)); while (!isPrime(n)) n++; return n; },
    inExample: '100', outExample: 101,
  }),

  /* ---------- 进制 ---------- */
  op('base', '进制', '进制转换 (数值, 原进制, 目标进制)，2~36', {
    count: 3,
    outLayout: 'string',
    run: ([v, from, to]) => parseInt(String(v), from).toString(to).toUpperCase(),
    inExample: '255 10 16', outExample: 'FF', desc: '三个数字：数值 原进制 目标进制',
  }),

  /* ---------- 常量 ---------- */
  {
    name: 'constant',
    group: '常量',
    summary: '取数学常量：pi / e / phi / sqrt2 / ln2 / ln10',
    args: [],
    input: { kind: 'values', layout: 'string', min: 1, desc: '常量名，如 pi', example: 'pi' },
    output: { layout: 'number', desc: '常量值', example: 3.14159265359 },
    examples: [{ input: 'pi', expect: '3.14159265359' }],
    run: (ctx) => {
      const key = ctx.desc.strings()[0].toLowerCase();
      const map = {
        pi: Math.PI, e: Math.E, phi: (1 + Math.sqrt(5)) / 2,
        sqrt2: Math.SQRT2, ln2: Math.LN2, ln10: Math.LN10,
        tau: Math.PI * 2, euler: 0.5772156649015329,
      };
      if (!(key in map)) throw new Error(`未知常量: ${key}，可用: ${Object.keys(map).join(' ')}`);
      return fmt(map[key]);
    },
  },
];

module.exports = {
  name: TOOL,
  title: '基础数学工具',
  category: '通用 / 数学',
  summary: '加减乘除、取整、指数对数、三角、数论、进制转换',
  version: require('../../package.json').version,
  functions,
};
