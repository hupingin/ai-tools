#!/usr/bin/env node
'use strict';

/**
 * 总入口：
 *   ai-tools                     列出全部工具
 *   ai-tools <tool> <fn> [选项]   转发到具体工具
 *   ai-tools index [--json]       输出全局清单
 */
const { run } = require('../lib/cli');
const registry = require('../registry');
const table = require('../lib/table');

const argv = process.argv.slice(2);

function listTools() {
  const tools = registry.loadAll();
  const rows = [['TOOL', 'CATEGORY', 'FUNCTIONS', 'SUMMARY']];
  for (const t of tools) rows.push([t.name, t.category || '-', String(t.functions.length), t.summary || '']);
  process.stdout.write(`ai-tools — 面向 AI 的统一范式命令行工具集\n\n用法: ai-tools <tool> <function> -i input.desc -o output.desc\n\n`);
  process.stdout.write(table.render(rows, { header: true }) + '\n');
  process.stdout.write(`\n共 ${tools.length} 个工具。用 \`ai-tools <tool> list\` 查看某工具的全部函数。\n`);
}

function index(asJson) {
  const tools = registry.loadAll().map((t) => ({
    name: t.name,
    title: t.title || t.name,
    category: t.category || '',
    summary: t.summary || '',
    version: t.version || '',
    command: `${t.name} <function> -i input.desc -o output.desc`,
    functionCount: t.functions.length,
    functions: t.functions.map((f) => ({ name: f.name, group: f.group || '', summary: f.summary || '' })),
  }));
  if (asJson) {
    process.stdout.write(JSON.stringify({ spec: 'DESC/1.0', tools }, null, 2) + '\n');
    return;
  }
  const rows = [['TOOL', 'GROUP', 'FUNCTION', 'SUMMARY']];
  for (const t of tools) {
    for (const f of t.functions) rows.push([t.name, f.group || '-', f.name, f.summary || '']);
  }
  process.stdout.write(table.render(rows, { header: true }) + '\n');
}

/**
 * 解析工具名，容忍 AI 少写 `_tool` 后缀或只写核心词：
 *   basic_math_tool / basic_math / math -> basic_math_tool
 * 别名冲突（多个工具匹配同一个词）时返回 null，避免猜错。
 */
const ALIAS = (() => {
  const map = new Map();
  const add = (alias, tool) => {
    if (!map.has(alias)) map.set(alias, new Set());
    map.get(alias).add(tool);
  };
  for (const t of registry.TOOLS) {
    const core = t.replace(/_tool$/, '');
    add(t, t);
    add(core, t);
    for (const seg of core.split('_')) add(seg, t);
  }
  return map;
})();

function resolveTool(name) {
  const raw = String(name || '').toLowerCase();
  const hit = ALIAS.get(raw);
  if (!hit || hit.size !== 1) return null;
  return [...hit][0];
}

async function main() {
  if (!argv.length || argv[0] === '-h' || argv[0] === '--help' || argv[0] === 'help' || argv[0] === 'list') {
    listTools();
    return 0;
  }
  if (argv[0] === 'index') {
    index(argv.includes('--json'));
    return 0;
  }
  const name = resolveTool(argv[0]);
  if (!name) {
    process.stderr.write(`未知工具: ${argv[0]}\n可用: ${registry.TOOLS.join(', ')}\n`);
    return 4;
  }
  return run(registry.load(name), argv.slice(1));
}

main().then((code) => { process.exitCode = code || 0; });
