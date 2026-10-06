'use strict';

const { inputError, usageError } = require('../../lib/errors');
const { fmt } = require('../../lib/num');

/**
 * 换算表：每个类别给出「单位 -> 基准单位数值」的因子。
 * 温度是仿射变换，单独处理。
 */
const CATEGORIES = {
  length: {
    base: 'm', name: '长度',
    units: {
      nm: 1e-9, um: 1e-6, mm: 0.001, cm: 0.01, dm: 0.1, m: 1, km: 1000,
      in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344, nmi: 1852,
      ly: 9.4607304725808e15, au: 1.495978707e11, pc: 3.0856775814913673e16,
    },
    aliases: { inch: 'in', inches: 'in', foot: 'ft', feet: 'ft', mile: 'mi', miles: 'mi', meter: 'm', meters: 'm', kilometre: 'km', kilometer: 'km' },
  },
  mass: {
    base: 'kg', name: '质量',
    units: {
      mg: 1e-6, g: 0.001, kg: 1, t: 1000, ct: 0.0002,
      oz: 0.028349523125, lb: 0.45359237, st: 6.35029318,
      ton_us: 907.18474, ton_uk: 1016.0469088,
    },
    aliases: { gram: 'g', grams: 'g', kilogram: 'kg', tonne: 't', pound: 'lb', pounds: 'lb', ounce: 'oz' },
  },
  time: {
    base: 's', name: '时间',
    units: {
      ns: 1e-9, us: 1e-6, ms: 0.001, s: 1, min: 60, h: 3600,
      d: 86400, wk: 604800, mo: 2592000, yr: 31536000,
    },
    aliases: { sec: 's', secs: 's', second: 's', seconds: 's', minute: 'min', minutes: 'min', hour: 'h', hours: 'h', day: 'd', days: 'd', week: 'wk', weeks: 'wk', month: 'mo', year: 'yr', years: 'yr' },
  },
  area: {
    base: 'm2', name: '面积',
    units: {
      mm2: 1e-6, cm2: 1e-4, m2: 1, km2: 1e6, ha: 10000,
      in2: 0.00064516, ft2: 0.09290304, yd2: 0.83612736,
      acre: 4046.8564224, mi2: 2589988.110336,
    },
    aliases: { hectare: 'ha', 'sq m': 'm2', 'sq ft': 'ft2', 'sq mi': 'mi2' },
  },
  volume: {
    base: 'L', name: '体积',
    units: {
      ml: 0.001, cl: 0.01, dl: 0.1, L: 1, m3: 1000, cm3: 0.001, mm3: 1e-6,
      tsp: 0.00492892159375, tbsp: 0.01478676478125, cup: 0.2365882365,
      floz: 0.0295735295625, pt: 0.473176473, qt: 0.946352946,
      gal: 3.785411784, gal_uk: 4.54609, bbl: 158.987294928,
    },
    aliases: { l: 'L', liter: 'L', litre: 'L', liters: 'L', litres: 'L', milliliter: 'ml', gallon: 'gal', gallons: 'gal' },
  },
  speed: {
    base: 'm/s', name: '速度',
    units: {
      'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, 'ft/s': 0.3048, kn: 0.5144444444,
      mach: 340.29, c: 299792458,
    },
    aliases: { kph: 'km/h', 'kmh': 'km/h', knot: 'kn', knots: 'kn' },
  },
  data: {
    base: 'B', name: '数据量',
    units: {
      bit: 0.125, B: 1, KB: 1000, KiB: 1024, MB: 1e6, MiB: 1048576,
      GB: 1e9, GiB: 1073741824, TB: 1e12, TiB: 1099511627776, PB: 1e15, PiB: 1125899906842624,
    },
    aliases: { byte: 'B', bytes: 'B', kilobyte: 'KB', megabyte: 'MB', gigabyte: 'GB', terabyte: 'TB' },
  },
  pressure: {
    base: 'Pa', name: '压强',
    units: {
      Pa: 1, kPa: 1000, MPa: 1e6, hPa: 100, bar: 1e5, mbar: 100,
      atm: 101325, psi: 6894.757293168, mmHg: 133.322387415, torr: 133.3223684211,
    },
    aliases: { pascal: 'Pa' },
  },
  energy: {
    base: 'J', name: '能量',
    units: {
      J: 1, kJ: 1000, MJ: 1e6, cal: 4.184, kcal: 4184,
      Wh: 3600, kWh: 3.6e6, eV: 1.602176634e-19,
      BTU: 1055.05585262, 'ft-lb': 1.3558179483314,
    },
    aliases: { joule: 'J', calories: 'cal' },
  },
  power: {
    base: 'W', name: '功率',
    units: {
      W: 1, kW: 1000, MW: 1e6, GW: 1e9,
      hp: 745.6998715822702, PS: 735.49875, 'BTU/h': 0.29307107017,
    },
    aliases: { watt: 'W', watts: 'W', horsepower: 'hp' },
  },
  angle: {
    base: 'deg', name: '角度',
    units: {
      deg: 1, rad: 180 / Math.PI, grad: 0.9, turn: 360,
      arcmin: 1 / 60, arcsec: 1 / 3600,
    },
    aliases: { degree: 'deg', degrees: 'deg', radian: 'rad', radians: 'rad' },
  },
  temperature: {
    base: 'C', name: '温度', affine: true,
    units: { C: 1, F: 1, K: 1, R: 1 },
    aliases: { c: 'C', f: 'F', k: 'K', celsius: 'C', fahrenheit: 'F', kelvin: 'K' },
  },
};

/** 归一化单位名：小写、去空格、走别名 */
function normUnit(cat, raw) {
  const key = String(raw).trim();
  if (key in cat.units) return key;
  const lower = key.toLowerCase();
  if (lower in cat.units) return lower;
  const alias = cat.aliases[lower] || cat.aliases[key];
  if (alias && alias in cat.units) return alias;
  // 大小写不敏感再扫一遍（如 "MPa" / "mPa"）
  for (const u of Object.keys(cat.units)) {
    if (u.toLowerCase() === lower) return u;
  }
  return null;
}

/**
 * 解析单位。为消歧采用三趟匹配：
 *   1) 精确匹配（区分大小写）
 *   2) 别名匹配
 *   3) 忽略大小写匹配
 * 歧义单位（如 c 既是摄氏度又是光速）可用 "c@speed" 或 --category 指定。
 */
function resolve(raw, category) {
  if (category && !CATEGORIES[category]) {
    throw inputError(`未知类别: ${category}`, `可用: ${Object.keys(CATEGORIES).join(', ')}`);
  }
  const cats = category ? [[category, CATEGORIES[category]]] : Object.entries(CATEGORIES);
  const key = String(raw).trim();
  const lower = key.toLowerCase();

  for (const [name, cat] of cats) {
    if (key in cat.units) return { cat: name, catDef: cat, unit: key };
  }
  for (const [name, cat] of cats) {
    const a = cat.aliases[key] || cat.aliases[lower];
    if (a && a in cat.units) return { cat: name, catDef: cat, unit: a };
  }
  for (const [name, cat] of cats) {
    for (const u of Object.keys(cat.units)) {
      if (u.toLowerCase() === lower) return { cat: name, catDef: cat, unit: u };
    }
  }
  throw category
    ? inputError(`类别 ${category} 中没有单位 ${raw}`)
    : inputError(`未识别的单位: ${raw}`, '用 `unit_tool list_units` 查看全部单位');
}

function toBase(cat, unit, v) {
  if (cat.affine) {
    if (unit === 'C') return v;
    if (unit === 'F') return (v - 32) * 5 / 9;
    if (unit === 'K') return v - 273.15;
    if (unit === 'R') return (v - 491.67) * 5 / 9;
  }
  return v * cat.units[unit];
}

function fromBase(cat, unit, v) {
  if (cat.affine) {
    if (unit === 'C') return v;
    if (unit === 'F') return v * 9 / 5 + 32;
    if (unit === 'K') return v + 273.15;
    if (unit === 'R') return (v + 273.15) * 9 / 5;
  }
  return v / cat.units[unit];
}

function mk(name, group, summary, o) {
  return {
    name, group, summary,
    args: o.args || [],
    input: o.input || { kind: 'values', layout: 'text', min: 1, desc: o.inDesc, example: o.inExample },
    output: { layout: o.outLayout || 'text', desc: o.outDesc || '', example: o.outExample },
    examples: o.outExample !== undefined
      ? [{ input: String(o.inExample ?? ''), opts: o.exOpts, expect: String(o.outExample) }] : [],
    run: o.run,
  };
}

const functions = [
  mk('convert', '换算', '单位换算：输入 "数值 原单位 目标单位"，如 "100 km m"', {
    inDesc: '数值 + 原单位 + 目标单位；歧义单位可用 "m@length" 或 --category',
    args: [{ short: '-c', long: '--category', desc: '限定类别，解决同名单位歧义' }],
    outLayout: 'number',
    inExample: '100 km m', outExample: 100000,
    run: (ctx) => {
      const t = ctx.desc.tokens();
      if (t.length !== 3) throw inputError('需要 3 个值：数值 原单位 目标单位', '例如 "100 km m" 或 "100 C F"');
      const value = Number(t[0]);
      if (!Number.isFinite(value)) throw inputError(`数值无效: ${t[0]}`);
      const split = (s) => {
        const i = s.indexOf('@');
        return i > 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, ctx.opts.category];
      };
      const [fromRaw, fromCat] = split(t[1]);
      const [toRaw, toCat] = split(t[2]);
      const a = resolve(fromRaw, fromCat);
      const b = resolve(toRaw, toCat || a.cat);
      if (a.cat !== b.cat) throw inputError(`不能跨类别换算: ${a.cat} -> ${b.cat}`);
      return fmt(fromBase(a.catDef, b.unit, toBase(a.catDef, a.unit, value)));
    },
  }),
  mk('convert_batch', '换算', '批量换算：第 1 行 "原单位 目标单位"，其余每行一个数值', {
    inDesc: '第 1 行为 "原单位 目标单位"，第 2 行起每行一个数值',
    outLayout: 'rows', outDesc: '每行一个换算结果',
    inExample: 'km m\n1\n2', outExample: '1000\n2000',
    run: (ctx) => {
      const lines = ctx.desc.lines();
      if (lines.length < 2) throw inputError('至少 2 行：第 1 行单位对，其后为数值');
      const [fromRaw, toRaw] = lines[0].split(/\s+/);
      const a = resolve(fromRaw, ctx.opts.category);
      const b = resolve(toRaw, ctx.opts.category || a.cat);
      if (a.cat !== b.cat) throw inputError(`不能跨类别换算: ${a.cat} -> ${b.cat}`);
      return lines.slice(1).map((l) => {
        const v = Number(l.trim());
        if (!Number.isFinite(v)) throw inputError(`数值无效: ${l}`);
        return fmt(fromBase(a.catDef, b.unit, toBase(a.catDef, a.unit, v)));
      }).join('\n');
    },
  }),
  mk('categories', '查询', '列出全部单位类别', {
    input: { kind: 'none', layout: '(无需 input.desc)' },
    outLayout: 'rows', outDesc: '每行 "类别名 中文名 基准单位"',
    run: () => Object.entries(CATEGORIES).map(([k, v]) => `${k} ${v.name} ${v.base}`).join('\n'),
  }),
  mk('list_units', '查询', '列出单位，--category 限定类别', {
    input: { kind: 'none', layout: '(无需 input.desc)' },
    args: [{ short: '-c', long: '--category', desc: '类别名，缺省列出全部' }],
    outLayout: 'rows', outDesc: '每行 "类别 单位 换算因子"',
    run: (ctx) => {
      const only = ctx.opts.category;
      if (only && !CATEGORIES[only]) throw inputError(`未知类别: ${only}`);
      const out = [];
      for (const [k, v] of Object.entries(CATEGORIES)) {
        if (only && k !== only) continue;
        for (const u of Object.keys(v.units)) out.push(`${k} ${u} ${fmt(v.units[u])}`);
      }
      return out.join('\n');
    },
  }),
  mk('to_base', '查询', '换算为该类别的基准单位', {
    inDesc: '数值 + 单位', args: [{ short: '-c', long: '--category', desc: '限定类别' }],
    outLayout: 'number', inExample: '5 km', outExample: 5000,
    run: (ctx) => {
      const t = ctx.desc.tokens();
      if (t.length !== 2) throw inputError('需要 2 个值：数值 单位');
      const v = Number(t[0]);
      if (!Number.isFinite(v)) throw inputError(`数值无效: ${t[0]}`);
      const a = resolve(t[1], ctx.opts.category);
      return fmt(toBase(a.catDef, a.unit, v));
    },
  }),
  mk('explain', '查询', '说明一次换算的因子与类别，便于核对', {
    inDesc: '原单位 目标单位', outLayout: 'kv',
    inExample: 'km m', outExample: 'category length\nfrom km\nto m\nfactor 1000',
    run: (ctx) => {
      const t = ctx.desc.tokens();
      if (t.length !== 2) throw inputError('需要 2 个值：原单位 目标单位');
      const a = resolve(t[0], ctx.opts.category);
      const b = resolve(t[1], ctx.opts.category || a.cat);
      if (a.cat !== b.cat) throw inputError(`不能跨类别换算: ${a.cat} -> ${b.cat}`);
      if (a.catDef.affine) {
        return [`category ${a.cat}`, `from ${a.unit}`, `to ${b.unit}`, 'factor affine(温度)'].join('\n');
      }
      const f = a.catDef.units[a.unit] / a.catDef.units[b.unit];
      return [`category ${a.cat}`, `from ${a.unit}`, `to ${b.unit}`, `factor ${fmt(f)}`].join('\n');
    },
  }),
];

module.exports = {
  name: 'unit_tool',
  title: '单位换算工具',
  category: '通用 / 度量',
  summary: '长度、质量、温度、时间、面积、体积、速度、数据量、压强、能量、功率、角度的换算',
  version: require('../../package.json').version,
  functions,
};

module.exports._CATEGORIES = CATEGORIES;
module.exports._resolve = resolve;
module.exports._toBase = toBase;
module.exports._fromBase = fromBase;
