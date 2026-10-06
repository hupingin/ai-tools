#!/usr/bin/env node
'use strict';

/** 生成 INDEX.md（人类可读）与 MANIFEST.json（AI 可直接消费的全量契约） */
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../registry');
const { fnSchema } = require('../lib/cli');

const root = path.join(__dirname, '..');
const tools = registry.loadAll();

const manifest = {
  spec: 'DESC/1.0',
  generatedBy: 'scripts/gen-index.js',
  toolCount: tools.length,
  functionCount: tools.reduce((n, t) => n + t.functions.length, 0),
  tools: tools.map((t) => JSON.parse(fnSchema(t))),
};

fs.writeFileSync(path.join(root, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');

const L = [];
L.push('# AI Tools 索引');
L.push('');
L.push('> 本文件由 `npm run index` 自动生成，请勿手改。');
L.push('');
L.push(`共 **${manifest.toolCount}** 个工具、**${manifest.functionCount}** 个函数。`);
L.push('');
L.push('| 工具 | 行业分类 | 函数数 | 说明 |');
L.push('| --- | --- | --- | --- |');
for (const t of tools) {
  L.push(`| \`${t.name}\` | ${t.category || '-'} | ${t.functions.length} | ${t.summary || ''} |`);
}
L.push('');
for (const t of tools) {
  L.push(`## ${t.name}`);
  L.push('');
  L.push(`${t.title || t.name} — ${t.summary || ''}`);
  L.push('');
  L.push('```');
  L.push(`${t.name} <function> -i input.desc -o output.desc`);
  L.push('```');
  L.push('');
  const byGroup = new Map();
  for (const f of t.functions) {
    const g = f.group || '其他';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(f);
  }
  L.push('| 分组 | 函数 | 说明 | input.desc | output.desc |');
  L.push('| --- | --- | --- | --- | --- |');
  for (const [g, fns] of byGroup) {
    for (const f of fns) {
      const inEx = f.input && f.input.example !== undefined ? `\`${String(f.input.example).replace(/\|/g, '\\|').replace(/\n/g, ' ⏎ ')}\`` : '—';
      const outEx = f.output && f.output.example !== undefined ? `\`${String(f.output.example).replace(/\|/g, '\\|').replace(/\n/g, ' ⏎ ')}\`` : '—';
      L.push(`| ${g} | \`${f.name}\` | ${f.summary || ''} | ${inEx} | ${outEx} |`);
    }
  }
  L.push('');
}
fs.writeFileSync(path.join(root, 'INDEX.md'), L.join('\n') + '\n');
process.stdout.write(`已生成 INDEX.md 与 MANIFEST.json（${manifest.toolCount} 个工具 / ${manifest.functionCount} 个函数）\n`);
