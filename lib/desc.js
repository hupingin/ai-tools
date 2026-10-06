'use strict';

const { inputError } = require('./errors');

const WS = /\s+/;

/**
 * DESC/1.0 —— 极简裸数据描述文件读取器。
 *
 * 一个 .desc 文件就是一个「负载(playload)」，没有信封、没有 key。
 * 负载怎么解释，由 `tool + function` 的契约决定。
 *
 * 读取器提供三层视图，函数按需取用：
 *   L0 原文   desc.raw / desc.text / desc.payload()
 *   L1 行     desc.lines()
 *   L2 字段   desc.tokens() / desc.numbers() / desc.kv() / desc.json()
 *
 * 这样既能满足「input.desc 就是 1 2」的极简诉求，
 * 又能让复杂函数（CSV/JSON/表格）自己定义行格式。
 */
class Desc {
  /**
   * @param {string|Buffer} text 文件内容
   * @param {{sep?:string|RegExp, comments?:boolean}} opts
   *        sep      字段分隔符，默认空白符；null 表示仍用空白符
   *        comments 是否忽略以 # 开头的行。默认 false（保证 text 类工具字节保真）
   */
  constructor(text = '', opts = {}) {
    if (Buffer.isBuffer(text)) text = text.toString('utf8');
    this.raw = typeof text === 'string' ? text : String(text);
    this.opts = { sep: null, comments: false, ...opts };
  }

  /** 归一化为 \n 换行 */
  get text() {
    return this.raw.replace(/\r\n/g, '\n');
  }

  /** 去掉末尾一个换行后的整段原文——适合"整段文本即负载"的函数 */
  payload() {
    return this.text.replace(/\n$/, '');
  }

  isEmpty() {
    return this.text.trim() === '';
  }

  /**
   * L1 行视图
   * @param {{keepEmpty?:boolean, trim?:boolean, comments?:boolean}} o
   */
  lines(o = {}) {
    const { keepEmpty = false, trim = true } = o;
    const comments = o.comments === undefined ? !!this.opts.comments : !!o.comments;
    let arr = this.text.split('\n');
    if (comments) arr = arr.filter((l) => !/^\s*#/.test(l));
    if (!keepEmpty) arr = arr.filter((l) => l.trim() !== '');
    return trim ? arr.map((l) => l.trim()) : arr;
  }

  /** 保留空行的原始行（CSV / 需要位置信息的场景用） */
  rawLines(o = {}) {
    return this.lines({ keepEmpty: true, trim: false, ...o });
  }

  /**
   * L2 字段视图：把所有行按分隔符切成扁平 token 数组
   * "1 2"  -> ["1","2"]
   * "1\n2" -> ["1","2"]
   */
  tokens(sep) {
    const s = sep === undefined ? this.opts.sep : sep;
    const out = [];
    for (const line of this.lines()) {
      const parts = s ? line.split(s) : line.split(WS);
      for (const p of parts) {
        const v = s ? p.trim() : p;
        if (v !== '') out.push(v);
      }
    }
    return out;
  }

  strings() {
    return this.tokens();
  }

  /**
   * 把所有 token 解析为数字。
   * @param {{count?:number, min?:number, max?:number}} o 数量约束
   */
  numbers(o = {}) {
    const t = this.tokens();
    const n = t.length;
    if (o.count !== undefined && n !== o.count) {
      throw inputError(
        `需要 ${o.count} 个数值，实际读到 ${n} 个`,
        `input.desc 应为空白分隔的 ${o.count} 个数字，例如 "${Array.from({ length: o.count }, (_, i) => i + 1).join(' ')}"`
      );
    }
    if (o.min !== undefined && n < o.min) {
      throw inputError(`至少需要 ${o.min} 个数值，实际读到 ${n} 个`);
    }
    if (o.max !== undefined && n > o.max) {
      throw inputError(`最多需要 ${o.max} 个数值，实际读到 ${n} 个`);
    }
    if (n === 0 && (o.min === undefined || o.min > 0)) {
      throw inputError('input.desc 为空，未读到任何数值');
    }
    return t.map((tok, i) => {
      const v = Number(tok);
      if (!Number.isFinite(v)) {
        throw inputError(
          `第 ${i + 1} 个值不是有效数字: ${JSON.stringify(tok)}`,
          '数值请用空白或换行分隔，例如 "1 2"'
        );
      }
      return v;
    });
  }

  /** 取第 i 个数值（0 基），缺失则报错 */
  number(i = 0) {
    const arr = this.numbers({ min: i + 1 });
    return arr[i];
  }

  /**
   * key: value / key = value 行视图（仅部分函数使用）
   * @returns {Record<string,string>}
   */
  kv(sep = ':') {
    const out = {};
    for (const line of this.lines()) {
      const m = line.match(/^([^:=]+)\s*[:=]\s*(.*)$/);
      if (!m) throw inputError(`无法解析为 key${sep} value 的行: ${JSON.stringify(line)}`);
      out[m[1].trim()] = m[2].trim();
    }
    return out;
  }

  /** 整段 JSON 视图 */
  json() {
    const s = this.text.trim();
    if (!s) throw inputError('input.desc 为空，无法解析 JSON');
    try {
      return JSON.parse(s);
    } catch (e) {
      throw inputError(`JSON 解析失败: ${e.message}`, 'input.desc 应包含一段完整 JSON');
    }
  }
}

module.exports = { Desc, WS };
