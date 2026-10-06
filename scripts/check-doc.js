#!/usr/bin/env node
'use strict';

/**
 * 校验 doc/ 说明书的完整性：本地链接存活、标签配平、没有 undefined 漏进页面。
 * CI 会在 npm run doc 之后跑它——防止改了工具却忘了重新生成文档。
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const docDir = path.join(root, 'doc');

if (!fs.existsSync(docDir)) {
  process.stderr.write('doc/ 不存在，请先运行 npm run doc\n');
  process.exit(1);
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) files.push(p);
  }
})(docDir);

const problems = [];
const linkRe = /href="([^"]+)"/g;

for (const f of files) {
  const rel = path.relative(root, f).replace(/\\/g, '/');
  const html = fs.readFileSync(f, 'utf8');
  const base = path.dirname(f);

  // 1. 占位符漏进页面（跳过 <pre> 代码块——正文里可能真的在讲这个词）
  const stripped = html.replace(/<pre[\s\S]*?<\/pre>/g, '');
  const undef = (stripped.match(/undefined|\[object Object\]/g) || []).length;
  if (undef) problems.push(`${rel}: 出现 ${undef} 处 undefined/[object Object]`);

  // 2. 本地链接必须存在（忽略锚点与外链）
  let m;
  while ((m = linkRe.exec(html))) {
    const href = m[1];
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    if (!fs.existsSync(path.resolve(base, href.split('#')[0]))) {
      problems.push(`${rel}: 死链 ${href}`);
    }
  }

  // 3. 主要标签配平
  for (const tag of ['div', 'table', 'pre', 'main', 'aside', 'section']) {
    const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (open !== close) problems.push(`${rel}: <${tag}> ${open} 个开标签 vs ${close} 个闭标签`);
  }

  // 4. 引用了静态资源
  if (!/<link rel="stylesheet" href="[^"]*assets\/doc\.css">/.test(html)) {
    problems.push(`${rel}: 未引用 assets/doc.css`);
  }
}

if (problems.length) {
  process.stderr.write(`doc 校验失败（${problems.length} 处）：\n`);
  for (const p of problems.slice(0, 40)) process.stderr.write('  - ' + p + '\n');
  if (problems.length > 40) process.stderr.write(`  ... 另有 ${problems.length - 40} 处\n`);
  process.exit(1);
}

process.stdout.write(`doc 校验通过：${files.length} 个页面，无死链 / 无占位符残留\n`);
