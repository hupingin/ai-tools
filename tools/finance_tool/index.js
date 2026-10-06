'use strict';

const { inputError } = require('../../lib/errors');
const { fmt, solve } = require('../../lib/num');

/**
 * 约定：所有利率参数使用「小数」，0.05 表示 5%。
 * 现金流符号：支出为负，收入为正。
 */

function nums(ctx, o) {
  return ctx.desc.numbers(o);
}

function mk(name, group, summary, o) {
  return {
    name, group, summary,
    args: o.args || [],
    input: { kind: 'values', layout: 'values', desc: o.inDesc, ...(o.count !== undefined ? { count: o.count } : { min: o.min }), example: o.inExample },
    output: { layout: o.outLayout || 'number', desc: o.outDesc || '', example: o.outExample },
    examples: o.outExample !== undefined
      ? [{ input: String(o.inExample ?? ''), opts: o.exOpts, expect: String(o.outExample) }] : [],
    run: o.run,
  };
}

/** 净现值 */
function npvOf(rate, cfs) {
  return cfs.reduce((s, cf, i) => s + cf / Math.pow(1 + rate, i), 0);
}

const functions = [
  /* ---------- 利息 ---------- */
  mk('simple_interest', '利息', '单利利息：本金 × 利率 × 年数', {
    count: 3, inDesc: '本金 年利率(0.05=5%) 年数',
    inExample: '10000 0.05 3', outExample: 1500,
    run: (ctx) => { const [p, r, t] = nums(ctx, { count: 3 }); return fmt(p * r * t); },
  }),
  mk('compound_interest', '利息', '复利终值 A = P(1 + r/n)^(nt)', {
    count: 4, inDesc: '本金 年利率 每年复利次数 年数',
    inExample: '10000 0.05 1 3', outExample: 11576.25,
    run: (ctx) => {
      const [p, r, n, t] = nums(ctx, { count: 4 });
      if (n <= 0) throw inputError('每年复利次数必须大于 0');
      return fmt(p * Math.pow(1 + r / n, n * t));
    },
  }),
  mk('continuous_interest', '利息', '连续复利终值 A = P·e^(rt)', {
    count: 3, inDesc: '本金 年利率 年数',
    inExample: '10000 0.05 3', outExample: 11618.342422,
    run: (ctx) => { const [p, r, t] = nums(ctx, { count: 3 }); return fmt(p * Math.exp(r * t)); },
  }),
  mk('ear', '利息', '有效年利率 EAR = (1 + r/n)^n - 1', {
    count: 2, inDesc: '名义年利率 每年复利次数',
    inExample: '0.12 12', outExample: 0.126825030132,
    run: (ctx) => {
      const [r, n] = nums(ctx, { count: 2 });
      if (n <= 0) throw inputError('复利次数必须大于 0');
      return fmt(Math.pow(1 + r / n, n) - 1);
    },
  }),
  mk('rule_of_72', '利息', '本金翻倍的估算年数 72 / (利率×100)', {
    count: 1, inDesc: '年利率（小数）',
    inExample: '0.06', outExample: 12,
    run: (ctx) => fmt(72 / (nums(ctx, { count: 1 })[0] * 100)),
  }),

  /* ---------- 现值终值 ---------- */
  mk('fv', '现值终值', '复利终值 FV = PV(1 + r)^n', {
    count: 3, inDesc: '现值 每期利率 期数',
    inExample: '1000 0.05 10', outExample: 1628.894627,
    run: (ctx) => { const [pv, r, n] = nums(ctx, { count: 3 }); return fmt(pv * Math.pow(1 + r, n)); },
  }),
  mk('pv', '现值终值', '现值 PV = FV / (1 + r)^n', {
    count: 3, inDesc: '终值 每期利率 期数',
    inExample: '1628.894627 0.05 10', outExample: 1000,
    run: (ctx) => { const [fv, r, n] = nums(ctx, { count: 3 }); return fmt(fv / Math.pow(1 + r, n)); },
  }),
  mk('npv', '现值终值', '净现值：第 1 个值为贴现率，其余为各期现金流', {
    min: 2, inDesc: '贴现率 现金流1 现金流2 ...（支出为负）',
    inExample: '0.1 -1000 300 400 500', outExample: -21.0368144252,
    run: (ctx) => {
      const a = nums(ctx, { min: 2 });
      return fmt(npvOf(a[0], a.slice(1)));
    },
  }),
  mk('irr', '现值终值', '内部收益率（使 NPV=0 的贴现率）', {
    min: 2, inDesc: '各期现金流，首期通常为负（支出）',
    inExample: '-1000 300 400 500', outExample: 0.0889633946933,
    run: (ctx) => {
      const cfs = nums(ctx, { min: 2 });
      if (!cfs.some((v) => v > 0) || !cfs.some((v) => v < 0)) {
        throw inputError('现金流必须同时包含正值与负值，才可能存在 IRR');
      }
      const f = (r) => npvOf(r, cfs);
      let x = solve(f, { guess: 0.1, lo: -0.9999, hi: 100 });
      if (!Number.isFinite(x)) {
        // 扩大搜索：在 [-0.99, 100] 上按符号变化找根
        let prev = -0.99, pv = f(prev), hit = NaN;
        for (let r = -0.95; r <= 100; r += 0.05) {
          const v = f(r);
          if (Number.isFinite(v) && Number.isFinite(pv) && pv * v <= 0) {
            hit = solve(f, { guess: r, lo: prev, hi: r });
            break;
          }
          prev = r; pv = v;
        }
        x = hit;
      }
      if (!Number.isFinite(x)) throw inputError('未能在合理区间内求得 IRR，请检查现金流序列');
      return fmt(x);
    },
  }),

  /* ---------- 贷款 ---------- */
  mk('pmt', '贷款', '等额还款每期金额 PMT = P·i / (1 - (1+i)^-n)', {
    count: 3, inDesc: '本金 每期利率 期数',
    inExample: '100000 0.005 120', outExample: 1110.20501942,
    run: (ctx) => {
      const [p, i, n] = nums(ctx, { count: 3 });
      if (i === 0) return fmt(p / n);
      return fmt(p * i / (1 - Math.pow(1 + i, -n)));
    },
  }),
  mk('amortization', '贷款', '等额本息摊销表，每行 "期次 利息 本金 剩余余额"', {
    count: 3, inDesc: '本金 每期利率 期数',
    outLayout: 'rows',
    inExample: '1000 0.1 3',
    outExample: '1 100 302.114804 697.885196\n2 69.78852 332.326284 365.558912\n3 36.555891 365.558912 0',
    run: (ctx) => {
      const [p, i, n] = nums(ctx, { count: 3 });
      if (n <= 0) throw inputError('期数必须大于 0');
      const pmt = i === 0 ? p / n : p * i / (1 - Math.pow(1 + i, -n));
      let bal = p;
      const out = [];
      for (let k = 1; k <= n; k++) {
        const interest = bal * i;
        let principal = pmt - interest;
        if (k === n) principal = bal;
        bal -= principal;
        out.push(`${k} ${fmt(interest)} ${fmt(principal)} ${fmt(Math.max(0, bal))}`);
      }
      return out.join('\n');
    },
  }),
  mk('total_interest', '贷款', '等额本息总利息', {
    count: 3, inDesc: '本金 每期利率 期数',
    inExample: '1000 0.1 3', outExample: 206.344410876,
    run: (ctx) => {
      const [p, i, n] = nums(ctx, { count: 3 });
      const pmt = i === 0 ? p / n : p * i / (1 - Math.pow(1 + i, -n));
      return fmt(pmt * n - p);
    },
  }),

  /* ---------- 投资 ---------- */
  mk('roi', '投资', '投资回报率 (收益 - 成本) / 成本', {
    count: 2, inDesc: '收益 成本',
    inExample: '1200 1000', outExample: 0.2,
    run: (ctx) => { const [g, c] = nums(ctx, { count: 2 }); return fmt((g - c) / c); },
  }),
  mk('cagr', '投资', '复合年增长率 (末值/初值)^(1/年数) - 1', {
    count: 3, inDesc: '期初值 期末值 年数',
    inExample: '1000 2000 5', outExample: 0.148698355,
    run: (ctx) => {
      const [b, e, y] = nums(ctx, { count: 3 });
      if (b <= 0 || y <= 0) throw inputError('期初值与年数必须大于 0');
      return fmt(Math.pow(e / b, 1 / y) - 1);
    },
  }),
  mk('margin', '投资', '毛利率 (收入 - 成本) / 收入', {
    count: 2, inDesc: '收入 成本',
    inExample: '200 150', outExample: 0.25,
    run: (ctx) => { const [rev, cost] = nums(ctx, { count: 2 }); return fmt((rev - cost) / rev); },
  }),
  mk('breakeven', '投资', '盈亏平衡销量 = 固定成本 / (单价 - 单位变动成本)', {
    count: 3, inDesc: '固定成本 单价 单位变动成本',
    inExample: '10000 50 30', outExample: 500,
    run: (ctx) => {
      const [fc, price, vc] = nums(ctx, { count: 3 });
      const cm = price - vc;
      if (cm <= 0) throw inputError('单位边际贡献必须大于 0，否则无法盈亏平衡');
      return fmt(fc / cm);
    },
  }),
  mk('payback', '投资', '静态回收期（年）：第 1 个值为初始投资(正数)，其余为各年净现金流', {
    min: 2, inDesc: '初始投资(正数) 第1年现金流 第2年现金流 ...',
    inExample: '300 100 150 200', outExample: 2.25,
    run: (ctx) => {
      const a = nums(ctx, { min: 2 });
      const invest = a[0];
      let acc = 0;
      for (let i = 1; i < a.length; i++) {
        const before = acc;
        acc += a[i];
        if (acc >= invest) return fmt(i - 1 + (invest - before) / a[i]);
      }
      return 'NaN';
    },
  }),
  mk('depreciation', '投资', '折旧：--method sl(直线)|ddb(双倍余额递减)|sy(年数总和)', {
    count: 3, inDesc: '原值 残值 年限',
    args: [{ long: '--method', default: 'sl', desc: 'sl|ddb|sy' }],
    outLayout: 'rows', outDesc: '每行一年的折旧额',
    inExample: '10000 1000 5', outExample: '1800\n1800\n1800\n1800\n1800',
    run: (ctx) => {
      const [cost, salvage, life] = nums(ctx, { count: 3 });
      const n = Math.max(1, Math.trunc(life));
      const m = String(ctx.opts.method || 'sl').toLowerCase();
      const out = [];
      if (m === 'sl') {
        const d = (cost - salvage) / n;
        for (let i = 0; i < n; i++) out.push(fmt(d));
      } else if (m === 'ddb') {
        let book = cost;
        for (let i = 0; i < n; i++) {
          let d = book * (2 / n);
          d = Math.min(d, Math.max(0, book - salvage));
          book -= d;
          out.push(fmt(d));
        }
      } else if (m === 'sy') {
        const sum = (n * (n + 1)) / 2;
        const base = cost - salvage;
        for (let i = 0; i < n; i++) out.push(fmt(base * (n - i) / sum));
      } else {
        throw inputError(`未知折旧方法: ${m}`, '可用 sl|ddb|sy');
      }
      return out.join('\n');
    },
  }),
];

module.exports = {
  name: 'finance_tool',
  title: '金融计算工具',
  category: '金融 / 财务',
  summary: '单利复利、现值终值、NPV/IRR、等额本息摊销、ROI/CAGR、盈亏平衡与折旧（利率统一用小数，0.05=5%）',
  version: require('../../package.json').version,
  functions,
};
