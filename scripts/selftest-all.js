#!/usr/bin/env node
'use strict';

/** 对所有工具执行内置示例自检（selftest），失败则退出码非 0 */
const registry = require('../registry');
const { fnSelftest } = require('../lib/cli');

let failed = 0;
let total = 0;
let fnTotal = 0;
let fnCovered = 0;

(async () => {
  for (const name of registry.TOOLS) {
    const tool = registry.load(name);
    const out = await fnSelftest(tool, { json: true });
    const r = JSON.parse(out);
    // 有 examples 的函数数（file_tool / image_tool 依赖文件系统与二进制，无静态示例）
    const covered = tool.functions.filter((f) => f.examples && f.examples.length).length;
    total += r.total;
    failed += r.failed;
    fnTotal += tool.functions.length;
    fnCovered += covered;
    const mark = r.failed === 0 ? 'OK  ' : 'FAIL';
    process.stdout.write(`${mark} ${name.padEnd(18)} ${String(r.passed).padStart(3)}/${String(r.total).padEnd(3)} 用例   函数 ${covered}/${tool.functions.length}\n`);
    for (const c of r.cases) {
      if (c.ok) continue;
      process.stdout.write(`       FAIL ${c.fn}#${c.i}\n`);
      process.stdout.write(`            expect: ${JSON.stringify(String(c.expect))}\n`);
      process.stdout.write(`            actual: ${JSON.stringify(String(c.actual))}\n`);
      if (c.err) process.stdout.write(`            error : ${c.err}\n`);
    }
  }
  process.stdout.write(`\n${total - failed}/${total} 条内置用例通过（覆盖 ${fnCovered}/${fnTotal} 个函数）\n`);
  process.exitCode = failed === 0 ? 0 : 1;
})();
