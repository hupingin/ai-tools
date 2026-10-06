'use strict';

/** 数值格式化：去掉浮点噪声，避免输出 0.30000000000000004 */
function fmt(n, precision = 12) {
  if (n === null || n === undefined) return '';
  if (typeof n !== 'number') n = Number(n);
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n) && Math.abs(n) < 1e21) return String(n);
  // 极大/极小的整数走指数
  if (Math.abs(n) >= 1e21 || (n !== 0 && Math.abs(n) < 1e-6)) return n.toExponential(10).replace(/\.?0+e/, 'e');
  let s = n.toPrecision(precision);
  if (s.includes('e')) return s;
  s = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return s;
}

/** 按小数位四舍五入（避免 toFixed 的浮点坑） */
function round(n, digits = 0) {
  const f = Math.pow(10, digits);
  return Math.round((n + Number.EPSILON * Math.sign(n) * Math.abs(n)) * f) / f;
}

function fmtFixed(n, digits = 2) {
  if (!Number.isFinite(n)) return String(n);
  return round(n, digits).toFixed(digits);
}

function sum(a) {
  return a.reduce((s, v) => s + v, 0);
}

function mean(a) {
  return a.length ? sum(a) / a.length : NaN;
}

/** 样本分位数，type=7（R/NumPy/pandas 默认线性插值） */
function quantile(sorted, q) {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const h = (n - 1) * q;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) throw new Error('阶乘要求非负整数');
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function gcd(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}

function lcm(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  if (a === 0 || b === 0) return 0;
  return (a / gcd(a, b)) * b;
}

function isPrime(n) {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  if (n % 3 === 0) return n === 3;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

function primeFactors(n) {
  if (!Number.isInteger(n) || n < 2) return [];
  let m = n;
  const out = [];
  for (let p = 2; p * p <= m; p++) {
    while (m % p === 0) { out.push(p); m /= p; }
  }
  if (m > 1) out.push(m);
  return out;
}

function fibonacci(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error('fibonacci 要求非负整数');
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) { const t = a + b; a = b; b = t; }
  return a;
}

/** 牛顿法 + 二分兜底的方程求根，用于 IRR 等 */
function solve(f, opts = {}) {
  const { guess = 0.1, lo = -0.999999, hi = 10, tol = 1e-10, maxIter = 200 } = opts;
  let x = guess;
  for (let i = 0; i < maxIter; i++) {
    const y = f(x);
    if (!Number.isFinite(y)) break;
    if (Math.abs(y) < tol) return x;
    const h = Math.max(1e-7, Math.abs(x) * 1e-7);
    const d = (f(x + h) - f(x - h)) / (2 * h);
    if (!Number.isFinite(d) || d === 0) break;
    const nx = x - y / d;
    if (!Number.isFinite(nx)) break;
    if (Math.abs(nx - x) < tol) return nx;
    x = nx;
  }
  // 二分兜底
  let a = lo, b = hi;
  let fa = f(a), fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb) || fa * fb > 0) return NaN;
  for (let i = 0; i < maxIter; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (!Number.isFinite(fm)) break;
    if (Math.abs(fm) < tol || Math.abs(b - a) < tol) return m;
    if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; }
  }
  return NaN;
}

module.exports = {
  fmt, round, fmtFixed, sum, mean, quantile,
  factorial, gcd, lcm, isPrime, primeFactors, fibonacci, solve,
};
