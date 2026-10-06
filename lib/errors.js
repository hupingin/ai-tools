'use strict';

/**
 * 统一退出码。所有 *_tool 共用同一张表，AI 只需记住 5 个数字。
 */
const EXIT = Object.freeze({
  OK: 0,       // 成功
  USAGE: 1,    // 用法错误：函数不存在、缺少必填选项
  INPUT: 2,    // 输入错误：input.desc 缺失、内容无法解析、校验失败
  RUNTIME: 3,  // 运行时错误：算法失败、IO 失败
  UNKNOWN: 4,  // 未知函数
});

class ToolError extends Error {
  constructor(code, message, hint) {
    super(message);
    this.name = 'ToolError';
    this.code = EXIT[code] === undefined ? 'RUNTIME' : code;
    this.exitCode = EXIT[this.code] === undefined ? EXIT.RUNTIME : EXIT[this.code];
    this.hint = hint || null;
  }

  format() {
    let s = `${this.code}(${this.exitCode}): ${this.message}`;
    if (this.hint) s += `\nhint: ${this.hint}`;
    return s;
  }
}

const usageError = (m, h) => new ToolError('USAGE', m, h);
const inputError = (m, h) => new ToolError('INPUT', m, h);
const runtimeError = (m, h) => new ToolError('RUNTIME', m, h);
const unknownError = (m, h) => new ToolError('UNKNOWN', m, h);

module.exports = { EXIT, ToolError, usageError, inputError, runtimeError, unknownError };
