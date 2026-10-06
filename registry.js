'use strict';

/**
 * 工具注册表：新增一个工具只需在这里加一行，并在 package.json 的 bin 里加一条。
 */
const TOOLS = [
  'basic_math_tool',
  'statistics_tool',
  'text_tool',
  'json_tool',
  'csv_tool',
  'datetime_tool',
  'file_tool',
  'crypto_tool',
  'unit_tool',
  'color_tool',
  'image_tool',
  'finance_tool',
];

function load(name) {
  if (!TOOLS.includes(name)) {
    throw new Error(`未知工具: ${name}。可用: ${TOOLS.join(', ')}`);
  }
  return require(`./tools/${name}`);
}

function loadAll() {
  return TOOLS.map(load);
}

module.exports = { TOOLS, load, loadAll };
