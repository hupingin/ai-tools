'use strict';

const { usageError, inputError } = require('../../lib/errors');
const { fmt } = require('../../lib/num');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MIN = 60000;

/** 解析时区偏移：480 / "+08:00" / "+8" / "Z" -> 分钟 */
function parseOffset(v) {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (s === 'Z' || s === 'z') return 0;
  if (/^[+-]?\d+$/.test(s)) return Number(s);
  const m = s.match(/^([+-])(\d{1,2}):?(\d{2})?$/);
  if (!m) throw new usageError(`无法解析时区偏移: ${v}`, '可用分钟数(480)或 +08:00');
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] || 0));
}

const ISO_RE = /^(-?\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3})\d*)?)?\s*(Z|[+-]\d{1,2}:?\d{2})?$/;
const SLASH_RE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/** 解析为 { ms, offset } —— 未带时区信息时按 UTC 处理 */
function parseDt(raw) {
  const s = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!s) throw inputError('日期时间为空');
  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    // 10 位=秒，13 位=毫秒
    return { ms: Math.abs(n) < 1e11 ? n * 1000 : n, offset: 0 };
  }
  let m = s.match(ISO_RE);
  if (!m) {
    const sm = s.match(SLASH_RE);
    if (sm) {
      const ms = Date.UTC(Number(sm[1]), Number(sm[2]) - 1, Number(sm[3]),
        Number(sm[4] || 0), Number(sm[5] || 0), Number(sm[6] || 0));
      return { ms, offset: 0 };
    }
    throw inputError(`无法解析日期时间: ${JSON.stringify(s)}`, '建议使用 ISO8601，如 2026-01-02T03:04:05Z 或 2026-01-02 03:04:05');
  }
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0), Number((m[7] || '0').padEnd(3, '0')));
  const off = m[8] ? parseOffset(m[8]) : 0;
  return { ms: ms - off * MIN, offset: off };
}

function viewOffset(ctx, fallback = 0) {
  return ctx.opts.offset === undefined || ctx.opts.offset === ''
    ? fallback
    : parseOffset(ctx.opts.offset);
}

const p2 = (n) => String(n).padStart(2, '0');
const p3 = (n) => String(n).padStart(3, '0');

/** ISO 周数（周一为一周之始，第 1 周含当年第一个周四） */
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fdayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fdayNum + 3);
  return 1 + Math.round((t - firstThursday) / (7 * 86400000));
}

function dayOfYear(d) {
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1;
}

/** strftime 风格格式化 */
function formatDt(ms, offsetMin, pattern) {
  const d = new Date(ms + offsetMin * MIN);
  const Y = d.getUTCFullYear();
  const Mo = d.getUTCMonth();
  const D = d.getUTCDate();
  const h = d.getUTCHours();
  const mi = d.getUTCMinutes();
  const se = d.getUTCSeconds();
  const msl = d.getUTCMilliseconds();
  const wd = d.getUTCDay();
  const sign = offsetMin < 0 ? '-' : '+';
  const aoff = Math.abs(offsetMin);
  const tokens = {
    Y: String(Y), y: p2(Y % 100), m: p2(Mo + 1), d: p2(D), e: String(D),
    H: p2(h), I: p2(h % 12 === 0 ? 12 : h % 12), M: p2(mi), S: p2(se), L: p3(msl),
    p: h < 12 ? 'AM' : 'PM', P: h < 12 ? 'am' : 'pm',
    a: DAYS_ABBR[wd], A: DAYS[wd], b: MONTHS_ABBR[Mo], B: MONTHS[Mo],
    j: String(dayOfYear(d)).padStart(3, '0'), U: p2(isoWeek(d)), W: p2(isoWeek(d)),
    z: `${sign}${p2(Math.floor(aoff / 60))}:${p2(aoff % 60)}`,
    Z: `${sign}${p2(Math.floor(aoff / 60))}${p2(aoff % 60)}`,
    s: String(Math.floor(ms / 1000)),
    F: `${Y}-${p2(Mo + 1)}-${p2(D)}`,
    T: `${p2(h)}:${p2(mi)}:${p2(se)}`,
    '%': '%',
  };
  return String(pattern).replace(/%(.)/g, (all, k) => (k in tokens ? tokens[k] : all));
}

const ISO_PATTERN = '%Y-%m-%dT%H:%M:%S%z';

function isoOf(ms, offsetMin) {
  return formatDt(ms, offsetMin, ISO_PATTERN);
}

function addMonths(ms, n, offset) {
  const d = new Date(ms + offset * MIN);
  const y = d.getUTCFullYear(), mo = d.getUTCMonth(), day = d.getUTCDate();
  const t = new Date(Date.UTC(y, mo + n, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
  const dim = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, dim));
  return t.getTime() - offset * MIN;
}

const UNIT_MS = {
  second: 1000, minute: 60000, hour: 3600000, day: 86400000, week: 604800000,
};
const UNIT_ALIAS = {
  s: 'second', sec: 'second', secs: 'second', second: 'second', seconds: 'second',
  m: 'minute', min: 'minute', mins: 'minute', minute: 'minute', minutes: 'minute',
  h: 'hour', hr: 'hour', hrs: 'hour', hour: 'hour', hours: 'hour',
  d: 'day', day: 'day', days: 'day',
  w: 'week', week: 'week', weeks: 'week',
  mo: 'month', month: 'month', months: 'month',
  y: 'year', yr: 'year', year: 'year', years: 'year',
};

function mk(name, group, summary, o) {
  return {
    name, group, summary,
    args: o.args || [],
    input: o.input || { kind: 'values', layout: 'text', min: 1, desc: '日期时间字符串', example: o.inExample },
    output: { layout: o.outLayout || 'text', desc: o.outDesc || '', example: o.outExample },
    examples: o.outExample !== undefined
      ? [{ input: o.inExample === undefined ? '' : String(o.inExample), opts: o.exOpts, expect: String(o.outExample) }] : [],
    run: o.run,
  };
}

const OFFSET_ARG = { long: '--offset', desc: '显示时区偏移：分钟数(480)或 +08:00，默认沿用输入时区/UTC' };
const FMT_ARG = { short: '-f', long: '--format', default: '%Y-%m-%d %H:%M:%S', desc: '输出格式，strftime 风格' };

const first = (ctx) => {
  const l = ctx.desc.lines();
  if (!l.length) throw inputError('input.desc 为空');
  return l[0];
};

const functions = [
  /* ---------- 当前时间 ---------- */
  mk('now', '当前时间', '输出当前时间，--offset 指定时区，--format 指定格式', {
    input: { kind: 'none', layout: '(无需 input.desc)', desc: '不读取输入文件' },
    args: [OFFSET_ARG, FMT_ARG],
    outDesc: '当前时间字符串',
    run: (ctx) => formatDt(Date.now(), viewOffset(ctx), ctx.opts.format || '%Y-%m-%d %H:%M:%S'),
  }),
  mk('today', '当前时间', '输出今天日期 %Y-%m-%d', {
    input: { kind: 'none', layout: '(无需 input.desc)' },
    args: [OFFSET_ARG],
    run: (ctx) => formatDt(Date.now(), viewOffset(ctx), '%Y-%m-%d'),
  }),

  /* ---------- 格式化 ---------- */
  mk('format', '格式化', '按 --format 格式化输入时间', {
    args: [OFFSET_ARG, FMT_ARG],
    inExample: '2026-01-02T03:04:05Z', outExample: '2026/01/02 03:04', exOpts: { format: '%Y/%m/%d %H:%M' },
    run: (ctx) => {
      const p = parseDt(first(ctx));
      return formatDt(p.ms, viewOffset(ctx, p.offset), ctx.opts.format || '%Y-%m-%d %H:%M:%S');
    },
  }),
  mk('to_iso', '格式化', '归一化为 ISO8601（带时区偏移）', {
    args: [OFFSET_ARG], outDesc: 'ISO8601 字符串',
    inExample: '2026/01/02 03:04', outExample: '2026-01-02T03:04:00+00:00',
    run: (ctx) => {
      const p = parseDt(first(ctx));
      return isoOf(p.ms, viewOffset(ctx, p.offset));
    },
  }),

  /* ---------- 运算 ---------- */
  mk('add', '运算', '时间加减：输入 "时间 数量 单位"，如 "2026-01-01 3 day"', {
    args: [OFFSET_ARG, FMT_ARG],
    inDesc: '时间 + 数量 + 单位(second|minute|hour|day|week|month|year)',
    inExample: '2026-01-01 3 day', outExample: '2026-01-04 00:00:00',
    run: (ctx) => {
      const t = ctx.desc.tokens();
      if (t.length < 3) throw inputError('需要 3 个值：时间 数量 单位', '例如 "2026-01-01 3 day"');
      const p = parseDt(t[0]);
      const n = Number(t[1]);
      if (!Number.isFinite(n)) throw inputError(`数量不是数字: ${t[1]}`);
      const off = viewOffset(ctx, p.offset);
      const unit = UNIT_ALIAS[String(t[2]).toLowerCase()];
      if (!unit) throw inputError(`未知单位: ${t[2]}`, '可用: second minute hour day week month year');
      let ms = p.ms;
      if (unit === 'month') ms = addMonths(ms, n, off);
      else if (unit === 'year') ms = addMonths(ms, n * 12, off);
      else ms += n * UNIT_MS[unit];
      return formatDt(ms, off, ctx.opts.format || '%Y-%m-%d %H:%M:%S');
    },
  }),
  mk('diff', '运算', '两个时间之差（后减前），--unit 指定单位', {
    args: [{ long: '--unit', default: 'day', desc: 'second|minute|hour|day|week' }],
    inDesc: '两行，每行一个时间',
    outLayout: 'number',
    inExample: '2026-01-01\n2026-01-11', outExample: 10,
    run: (ctx) => {
      const l = ctx.desc.lines();
      if (l.length < 2) throw inputError('需要两行：开始时间 与 结束时间');
      const a = parseDt(l[0]).ms, b = parseDt(l[1]).ms;
      const u = UNIT_ALIAS[String(ctx.opts.unit || 'day').toLowerCase()];
      if (!u || !UNIT_MS[u]) throw inputError(`--unit 只支持 second|minute|hour|day|week`);
      return fmt((b - a) / UNIT_MS[u]);
    },
  }),
  mk('business_days', '运算', '两个日期之间的工作日天数（含首、含尾，跳过周末）', {
    inDesc: '两行，每行一个日期', outLayout: 'number',
    inExample: '2026-01-01\n2026-01-11', outExample: 7,
    run: (ctx) => {
      const l = ctx.desc.lines();
      if (l.length < 2) throw inputError('需要两行：开始日期 与 结束日期');
      let a = parseDt(l[0]).ms, b = parseDt(l[1]).ms;
      if (a > b) { const t = a; a = b; b = t; }
      let count = 0;
      const cur = new Date(Math.floor(a / 86400000) * 86400000);
      const end = Math.floor(b / 86400000) * 86400000;
      while (cur.getTime() <= end) {
        const wd = cur.getUTCDay();
        if (wd !== 0 && wd !== 6) count++;
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      return String(count);
    },
  }),
  mk('add_business_days', '运算', '从起始日期起算 N 个工作日后的日期（跳过周末）', {
    inDesc: '日期 + 工作日数量',
    inExample: '2026-01-01 5', outExample: '2026-01-08 00:00:00',
    run: (ctx) => {
      const t = ctx.desc.tokens();
      if (t.length < 2) throw inputError('需要 2 个值：日期 工作日数');
      const p = parseDt(t[0]);
      let n = Math.trunc(Number(t[1]));
      if (!Number.isFinite(n)) throw inputError(`工作日数不是数字: ${t[1]}`);
      const off = viewOffset(ctx, p.offset);
      const cur = new Date(p.ms + off * MIN);
      const step = n >= 0 ? 1 : -1;
      let left = Math.abs(n);
      while (left > 0) {
        cur.setUTCDate(cur.getUTCDate() + step);
        const wd = cur.getUTCDay();
        if (wd !== 0 && wd !== 6) left--;
      }
      return formatDt(cur.getTime() - off * MIN, off, ctx.opts.format || '%Y-%m-%d %H:%M:%S');
    },
  }),

  /* ---------- 属性 ---------- */
  mk('weekday', '属性', '星期几，输出 "ISO序号 英文名"（1=周一）', {
    args: [OFFSET_ARG],
    inExample: '2026-01-01', outExample: '4 Thursday',
    run: (ctx) => {
      const p = parseDt(first(ctx));
      const d = new Date(p.ms + viewOffset(ctx, p.offset) * MIN);
      const wd = d.getUTCDay();
      return `${(wd + 6) % 7 + 1} ${DAYS[wd]}`;
    },
  }),
  mk('quarter', '属性', '所属季度 1~4', {
    args: [OFFSET_ARG], outLayout: 'number',
    inExample: '2026-05-01', outExample: 2,
    run: (ctx) => {
      const p = parseDt(first(ctx));
      const d = new Date(p.ms + viewOffset(ctx, p.offset) * MIN);
      return String(Math.floor(d.getUTCMonth() / 3) + 1);
    },
  }),
  mk('week_of_year', '属性', 'ISO 周序号', {
    args: [OFFSET_ARG], outLayout: 'number',
    inExample: '2026-01-01', outExample: 1,
    run: (ctx) => {
      const p = parseDt(first(ctx));
      const d = new Date(p.ms + viewOffset(ctx, p.offset) * MIN);
      return String(isoWeek(d));
    },
  }),
  mk('day_of_year', '属性', '一年中的第几天', {
    args: [OFFSET_ARG], outLayout: 'number',
    inExample: '2026-01-01', outExample: 1,
    run: (ctx) => {
      const p = parseDt(first(ctx));
      const d = new Date(p.ms + viewOffset(ctx, p.offset) * MIN);
      return String(dayOfYear(d));
    },
  }),
  mk('is_leap', '属性', '是否闰年，输出 true/false', {
    outLayout: 'boolean',
    input: { kind: 'values', layout: 'number', count: 1, desc: '年份', example: '2024' },
    inExample: '2024', outExample: 'true',
    run: (ctx) => {
      const y = Math.trunc(ctx.desc.numbers({ count: 1 })[0]);
      return String((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0);
    },
  }),
  mk('days_in_month', '属性', '该月天数', {
    outLayout: 'number',
    input: { kind: 'values', layout: 'text', min: 1, desc: 'YYYY-MM 或 YYYY M', example: '2024-02' },
    inExample: '2024-02', outExample: 29,
    run: (ctx) => {
      const s = first(ctx);
      const m = s.match(/^(-?\d{4})[-\s/](\d{1,2})/);
      if (!m) throw inputError('需要 YYYY-MM 形式，例如 2024-02');
      const y = Number(m[1]), mo = Number(m[2]);
      if (mo < 1 || mo > 12) throw inputError(`月份超出范围: ${mo}`);
      return String(new Date(Date.UTC(y, mo, 0)).getUTCDate());
    },
  }),
  mk('age', '属性', '距指定日期的周岁年数（第二行为"截至日期"，可省略）', {
    outLayout: 'number',
    inDesc: '第 1 行出生日期，第 2 行（可选）截至日期，默认今天',
    inExample: '2000-01-01\n2026-01-01', outExample: 26,
    run: (ctx) => {
      const l = ctx.desc.lines();
      if (!l.length) throw inputError('需要出生日期');
      const bp = parseDt(l[0]);
      const ap = l.length > 1 ? parseDt(l[1]) : { ms: Date.now(), offset: 0 };
      const bo = viewOffset(ctx, bp.offset);
      const ao = l.length > 1 ? viewOffset(ctx, ap.offset) : bo;
      const bd = new Date(bp.ms + bo * MIN);
      const ad = new Date(ap.ms + ao * MIN);
      let years = ad.getUTCFullYear() - bd.getUTCFullYear();
      const bm = bd.getUTCMonth(), am = ad.getUTCMonth();
      if (am < bm || (am === bm && ad.getUTCDate() < bd.getUTCDate())) years--;
      return String(years);
    },
  }),

  /* ---------- 时间戳 ---------- */
  mk('timestamp', '时间戳', '转 Unix 时间戳，--ms 输出毫秒', {
    args: [{ long: '--ms', flag: true, desc: '输出毫秒' }],
    outLayout: 'number',
    inExample: '1970-01-01T00:00:00Z', outExample: 0,
    run: (ctx) => {
      const p = parseDt(first(ctx));
      return String(ctx.opts.ms ? p.ms : Math.floor(p.ms / 1000));
    },
  }),
  mk('from_timestamp', '时间戳', 'Unix 时间戳转 ISO，自动识别秒/毫秒', {
    args: [OFFSET_ARG, FMT_ARG],
    input: { kind: 'values', layout: 'number', min: 1, desc: 'Unix 时间戳（秒或毫秒）', example: '0' },
    inExample: '0', outExample: '1970-01-01 00:00:00',
    run: (ctx) => {
      const n = Math.trunc(ctx.desc.numbers({ min: 1 })[0]);
      const ms = Math.abs(n) < 1e11 ? n * 1000 : n;
      return formatDt(ms, viewOffset(ctx), ctx.opts.format || '%Y-%m-%d %H:%M:%S');
    },
  }),

  /* ---------- 边界 ---------- */
  mk('start_of', '边界', '取所处周期的起点，--unit day|week|month|year', {
    args: [OFFSET_ARG, { long: '--unit', default: 'day', desc: 'day|week|month|year' }],
    inExample: '2026-05-17 10:20:30', outExample: '2026-05-17 00:00:00', exOpts: { unit: 'day' },
    run: (ctx) => {
      const p = parseDt(first(ctx));
      const off = viewOffset(ctx, p.offset);
      const d = new Date(p.ms + off * MIN);
      const u = String(ctx.opts.unit || 'day').toLowerCase();
      let y = d.getUTCFullYear(), mo = d.getUTCMonth(), da = d.getUTCDate();
      if (u === 'week') da -= (d.getUTCDay() + 6) % 7;
      else if (u === 'month') da = 1;
      else if (u === 'year') { mo = 0; da = 1; }
      else if (u !== 'day') throw inputError('--unit 只支持 day|week|month|year');
      return formatDt(Date.UTC(y, mo, da) - off * MIN, off, '%Y-%m-%d %H:%M:%S');
    },
  }),
  mk('end_of', '边界', '取所处周期的终点（含最后一秒），--unit day|week|month|year', {
    args: [OFFSET_ARG, { long: '--unit', default: 'day', desc: 'day|week|month|year' }],
    inExample: '2026-05-17 10:20:30', outExample: '2026-05-17 23:59:59', exOpts: { unit: 'day' },
    run: (ctx) => {
      const p = parseDt(first(ctx));
      const off = viewOffset(ctx, p.offset);
      const d = new Date(p.ms + off * MIN);
      const u = String(ctx.opts.unit || 'day').toLowerCase();
      let y = d.getUTCFullYear(), mo = d.getUTCMonth(), da = d.getUTCDate();
      if (u === 'day') { /* 当日 23:59:59 */ }
      else if (u === 'week') da += 6 - ((d.getUTCDay() + 6) % 7);
      else if (u === 'month') { mo += 1; da = 0; }
      else if (u === 'year') { y += 1; mo = 0; da = 0; }
      else throw inputError('--unit 只支持 day|week|month|year');
      const base = u === 'month' || u === 'year'
        ? Date.UTC(y, mo, da)
        : Date.UTC(y, mo, da);
      return formatDt(base + 86399000 - off * MIN, off, '%Y-%m-%d %H:%M:%S');
    },
  }),
  mk('convert_tz', '边界', '把时间换算到 --offset 指定的时区显示', {
    args: [{ long: '--offset', desc: '目标时区偏移：480 或 +08:00（必填）' }],
    inExample: '2026-01-01T00:00:00Z', outExample: '2026-01-01T08:00:00+08:00', exOpts: { offset: '480' },
    run: (ctx) => {
      if (ctx.opts.offset === undefined || ctx.opts.offset === '') throw usageError('缺少 --offset', '例如 --offset 480 或 --offset +08:00');
      const p = parseDt(first(ctx));
      return isoOf(p.ms, parseOffset(ctx.opts.offset));
    },
  }),
];

module.exports = {
  name: 'datetime_tool',
  title: '日期时间工具',
  category: '通用 / 时间',
  summary: 'ISO8601 解析与格式化、时间加减、差值、工作日、时间戳、周期边界',
  version: require('../../package.json').version,
  functions,
};
