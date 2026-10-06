#!/usr/bin/env node
'use strict';

/**
 * 生成 doc/ 静态文档站（纯 HTML/CSS/JS，无构建、无第三方依赖）。
 *
 *   node scripts/gen-doc.js
 *
 * 产出：
 *   doc/index.html            总览与快速开始
 *   doc/spec.html             DESC/1.0 规范（由 SPEC.md 渲染）
 *   doc/functions.html        全部函数的可搜索总表
 *   doc/tools/<name>.html     每个工具一页，含全部函数的输入输出契约
 *   doc/contributing.html     贡献指南（由 CONTRIBUTING.md 渲染）
 */
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../registry');
const { renderMarkdown, escapeHtml, toc } = require('./md');

const root = path.join(__dirname, '..');
const docDir = path.join(root, 'doc');
const REPO = 'https://github.com/hupingin/ai-tools';
const tools = registry.loadAll();
const FN_TOTAL = tools.reduce((n, t) => n + t.functions.length, 0);

/* ------------------------------------------------------------------ */
/* 布局骨架                                                             */
/* ------------------------------------------------------------------ */

const NAV_START = [
  { href: 'index.html', text: '总览' },
  { href: 'spec.html', text: 'DESC/1.0 规范' },
  { href: 'functions.html', text: '全部函数' },
  { href: 'contributing.html', text: '贡献指南' },
];

function sidebar(base, active) {
  const L = [];
  L.push('<aside class="sidebar">');
  L.push('<div class="side-group"><p class="side-title">开始</p>');
  for (const n of NAV_START) {
    L.push(`<a class="side-link${active === n.href ? ' on' : ''}" href="${base}${n.href}">${n.text}</a>`);
  }
  L.push('</div>');
  L.push('<div class="side-group"><p class="side-title">工具（12）</p>');
  for (const t of tools) {
    const href = `tools/${t.name}.html`;
    L.push(`<a class="side-link${active === href ? ' on' : ''}" href="${base}${href}"><span>${t.name}</span><span class="n">${t.functions.length}</span></a>`);
  }
  L.push('</div>');
  L.push('</aside>');
  return L.join('\n');
}

function page(o) {
  const base = o.base || '';
  const themeInit = `(function(){var k='ai-tools-doc-theme',v=null;try{v=localStorage.getItem(k)}catch(e){}if(!v){v=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark'}document.documentElement.setAttribute('data-theme',v)})()`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(o.title)} — ai-tools 文档</title>
<meta name="description" content="ai-tools：面向 AI 的统一范式命令行工具集，${tools.length} 个工具 / ${FN_TOTAL} 个函数，零第三方依赖。">
<link rel="stylesheet" href="${base}assets/doc.css">
<script>${themeInit}</script>
</head>
<body>
<header class="topbar">
  <a class="brand" href="${base}index.html"><span class="mark">A</span>ai-tools <small>${tools.length} 工具 / ${FN_TOTAL} 函数</small></a>
  <nav class="topnav">
${NAV_START.map((n) => `    <a href="${base}${n.href}"${o.active === n.href ? ' class="on"' : ''}>${n.text}</a>`).join('\n')}
  </nav>
  <span class="spacer"></span>
  <button class="icon-btn" type="button" data-theme-toggle title="切换主题">☾</button>
  <a class="icon-btn" href="${REPO}" title="GitHub" target="_blank" rel="noopener">↗</a>
</header>
<div class="layout">
${sidebar(base, o.active || '')}
  <main class="content">
${o.body}
    <div class="footer">
      ai-tools · DESC/1.0 · 零第三方依赖 · <a href="${REPO}" target="_blank" rel="noopener">GitHub</a><br>
      本页由 <code>npm run doc</code> 自动生成，请勿手改。
    </div>
  </main>
</div>
<script src="${base}assets/doc.js"></script>
</body>
</html>
`;
}

function write(rel, html) {
  const p = path.join(docDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
  return p;
}

/* ------------------------------------------------------------------ */
/* 片段                                                                 */
/* ------------------------------------------------------------------ */

function h(n, text, id) {
  return `<h${n} id="${id || ''}"${id ? ' class="anchor"' : ''}>${id ? `<a href="#${id}">${text}</a>` : text}</h${n}>`;
}

function codeBlock(text, lang) {
  return `<pre class="code"${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}><code>${escapeHtml(text)}</code></pre>`;
}

/**
 * 把 Markdown 里指向仓库文件的链接改写成文档站内链接。
 *   ./SPEC.md -> spec.html      ./tools/x_tool/ -> tools/x_tool.html
 *   其余 .md/.json -> GitHub 上的对应文件
 */
function rewriteLinks(html) {
  return html
    .replace(/href="\.\/(SPEC|CONTRIBUTING|README)\.md"/g, (m, n) => `href="${{ SPEC: 'spec', CONTRIBUTING: 'contributing', README: 'index' }[n]}.html"`)
    .replace(/href="\.\/tools\/([a-z_]+)_tool\/?"/g, 'href="tools/$1_tool.html"')
    .replace(/href="\.\/([A-Za-z0-9_./-]+\.(?:md|json))"/g, `href="${REPO}/blob/main/$1"`);
}

function ioCell(label, val, hint) {
  const empty = val === undefined || val === null || String(val) === '';
  return `<div class="io">
      <div class="lbl">${label}</div>
      <div class="val${empty ? ' none' : ''}">${empty ? '(不需要)' : escapeHtml(String(val))}</div>
      ${hint ? `<div class="hint">${escapeHtml(hint)}</div>` : ''}
    </div>`;
}

function argsTable(args) {
  if (!args || !args.length) return '';
  let t = '<div class="table-wrap"><table><thead><tr><th>选项</th><th>参数</th><th>默认</th><th>说明</th></tr></thead><tbody>';
  for (const a of args) {
    const flag = `${a.short ? escapeHtml(a.short) + ', ' : ''}${escapeHtml(a.long || '')}`;
    t += `<tr><td><code>${flag}</code></td><td>${a.flag ? '' : `<code>${escapeHtml(a.arg || 'VAL')}</code>`}</td><td>${a.default === undefined ? '' : `<code>${escapeHtml(String(a.default))}</code>`}</td><td>${escapeHtml(a.desc || '')}</td></tr>`;
  }
  return t + '</tbody></table></div>';
}

/** 单个函数的完整卡片 */
function fnCard(t, f) {
  const in_ = f.input || {};
  const out_ = f.output || {};
  const L = [];
  L.push(`<div class="fn" id="${f.name}" data-fn="${escapeHtml(t.name + ' ' + f.name + ' ' + (f.group || '') + ' ' + (f.summary || ''))}">`);
  L.push('  <div class="fn-head">');
  L.push(`    <span class="fn-name">${escapeHtml(f.name)}</span>`);
  L.push(`    <span class="fn-sum">${escapeHtml(f.summary || '')}</span>`);
  if (f.group) L.push(`    <span class="tag">${escapeHtml(f.group)}</span>`);
  if (in_.count) L.push(`    <span class="tag">${in_.count} 个输入值</span>`);
  else if (in_.min !== undefined) L.push(`    <span class="tag">≥${in_.min} 个输入值</span>`);
  if (in_.kind === 'none') L.push('    <span class="tag">无需输入</span>');
  L.push('  </div>');
  L.push('  <div class="fn-body">');
  L.push(`    <pre class="code tight" data-lang="bash"><code>${escapeHtml(`${t.name} ${f.name} -i input.desc -o output.desc`)}</code></pre>`);
  L.push('    <div class="fn-io">');
  L.push(`      ${ioCell('input.desc', in_.example, in_.desc || (in_.kind ? `布局：${in_.kind}` : ''))}`);
  L.push(`      ${ioCell('output.desc', out_.example, out_.desc || (out_.layout ? `布局：${out_.layout}` : ''))}`);
  L.push('    </div>');
  const at = argsTable(f.args);
  if (at) L.push(`    ${at}`);
  if (f.examples && f.examples.length) {
    L.push('    <div class="fn-ex">');
    for (const ex of f.examples) {
      const opt = ex.opts && Object.keys(ex.opts).length
        ? ' ' + Object.entries(ex.opts).map(([k, v]) => `--${k} ${v}`).join(' ')
        : '';
      L.push(`      <div class="row"><span class="k">in </span><span class="v">${escapeHtml(String(ex.input === undefined ? '' : ex.input))}</span>${opt ? `<span class="k"> ${escapeHtml(opt)}</span>` : ''}</div>`);
      L.push(`      <div class="row"><span class="k">out</span> <span class="v">${escapeHtml(String(ex.expect))}</span></div>`);
    }
    L.push('    </div>');
  }
  L.push('  </div>');
  L.push('</div>');
  return L.join('\n');
}

/* ------------------------------------------------------------------ */
/* 页面 1：总览                                                         */
/* ------------------------------------------------------------------ */

function buildIndex() {
  const add = tools[0].functions.find((f) => f.name === 'add');
  const L = [];

  L.push(`<section class="hero">
    <h1>ai-tools：为 AI 重新造轮子</h1>
    <p class="sub">软件五花八门，调用方式也五花八门。这个项目把「一个功能」收敛成一种 AI 能稳定生成、稳定解析、稳定组合的形态——统一的命令、统一的裸数据文件、统一的退出码。</p>
    <div class="chips">
      <span class="chip"><b>${tools.length}</b> 个工具</span>
      <span class="chip"><b>${FN_TOTAL}</b> 个函数</span>
      <span class="chip">零第三方依赖</span>
      <span class="chip">Node ≥ 18</span>
      <span class="chip">MIT</span>
    </div>
    <div class="demo">
      <div class="demo-cell">
        <div class="lbl">input.desc</div>
        <div class="val">${escapeHtml(add ? add.input.example : '1 2')}</div>
      </div>
      <div class="demo-arrow">→</div>
      <div class="demo-cell">
        <div class="lbl">output.desc</div>
        <div class="val">${escapeHtml(String(add ? add.output.example : 3))}</div>
      </div>
    </div>
    <div class="demo-cmd">
      ${codeBlock('printf \'1 2\' > input.desc\nbasic_math_tool add -i input.desc -o output.desc\ncat output.desc   # => 3', 'bash')}
    </div>
  </section>`);

  L.push(h(2, '安装', 'install'));
  L.push(codeBlock(`git clone ${REPO}.git\ncd ai-tools\nnpm link          # 或 npm install -g .`, 'bash'));
  L.push('<p>也可以免安装直接跑：</p>');
  L.push(codeBlock('node bin/basic_math_tool.js add -i input.desc -o output.desc\nnode bin/ai-tools.js basic_math add -i input.desc -o output.desc   # 聚合入口，工具名可省略 _tool', 'bash'));

  L.push(h(2, '工具一览', 'tools'));
  L.push('<div class="cards">');
  for (const t of tools) {
    L.push(`  <a class="card" href="tools/${t.name}.html">
    <div class="cname">${escapeHtml(t.name)}</div>
    <div class="cmeta">${escapeHtml(t.category || '')} · ${t.functions.length} 个函数</div>
    <div class="cdesc">${escapeHtml(t.summary || '')}</div>
  </a>`);
  }
  L.push('</div>');

  L.push(h(2, '四步调用一个函数', 'flow'));
  L.push(`<div class="table-wrap"><table>
<thead><tr><th>步骤</th><th>命令</th><th>说明</th></tr></thead>
<tbody>
<tr><td>1</td><td><code>ai-tools index</code></td><td>找到需要的工具（<code>--json</code> 给程序读）</td></tr>
<tr><td>2</td><td><code>xxx_tool list</code></td><td>找到需要的函数</td></tr>
<tr><td>3</td><td><code>xxx_tool help &lt;fn&gt;</code></td><td>读 input/output 契约与示例</td></tr>
<tr><td>4</td><td><code>xxx_tool &lt;fn&gt; -i input.desc -o output.desc</code></td><td>调用；退出码 0 再读输出</td></tr>
</tbody></table></div>`);

  L.push(h(2, '为什么这样设计', 'why'));
  L.push(`<div class="table-wrap"><table>
<thead><tr><th>取舍</th><th>说明</th></tr></thead>
<tbody>
<tr><td><b>调用方式唯一</b></td><td>永远是 <code>工具 函数 -i -o</code>，AI 不需要为每个库学一套 CLI</td></tr>
<tr><td><b>输入输出唯一</b></td><td>数据只走 <code>.desc</code> 文件，内容是极简裸数据——没有 JSON 信封、没有 key、没有类型标记</td></tr>
<tr><td><b>空格 ≡ 换行</b></td><td><code>1 2</code> 和 <code>1\\n2</code> 完全等价，AI 不必纠结排版</td></tr>
<tr><td><b>契约可自发现</b></td><td>每个工具自带 <code>list</code> / <code>help</code> / <code>schema</code> / <code>selftest</code>，不用查外部文档</td></tr>
<tr><td><b>退出码统一</b></td><td>0/1/2/3/4 五个码，跨全部工具同义</td></tr>
<tr><td><b>示例即测试</b></td><td>函数内嵌的 <code>examples</code> 同时是文档、few-shot 样本和回归用例</td></tr>
</tbody></table></div>`);

  L.push(h(2, '退出码', 'exit'));
  L.push(`<div class="table-wrap"><table>
<thead><tr><th>码</th><th>名称</th><th>含义</th><th>AI 该如何反应</th></tr></thead>
<tbody>
<tr><td><span class="code-pill ok">0</span></td><td>OK</td><td>成功</td><td>读 <code>output.desc</code></td></tr>
<tr><td><span class="code-pill warn">1</span></td><td>USAGE</td><td>用法错误（未知选项、缺必填项）</td><td>用 <code>help &lt;fn&gt;</code> 修正命令</td></tr>
<tr><td><span class="code-pill warn">2</span></td><td>INPUT</td><td>输入错误（文件缺失、无法解析、数量不符）</td><td>重写 <code>input.desc</code></td></tr>
<tr><td><span class="code-pill err">3</span></td><td>RUNTIME</td><td>运行时错误（算法失败、IO 失败）</td><td>换参数或换工具</td></tr>
<tr><td><span class="code-pill err">4</span></td><td>UNKNOWN</td><td>未知函数</td><td>用 <code>list</code> 查正确函数名</td></tr>
</tbody></table></div>`);
  L.push('<blockquote><p><b>重要</b>：退出码非 0 时 <code>output.desc</code> 不会被更新（可能是上一次的残留）。<b>先看退出码，再读文件。</b></p></blockquote>');

  L.push(h(2, '元函数（每个工具都有）', 'meta'));
  L.push(`<div class="table-wrap"><table>
<thead><tr><th>函数</th><th>作用</th></tr></thead>
<tbody>
<tr><td><code>list</code></td><td>列出全部函数</td></tr>
<tr><td><code>help &lt;fn&gt;</code></td><td>打印某函数的输入输出契约与示例</td></tr>
<tr><td><code>schema [fn]</code></td><td>输出 JSON 机器契约，交给 Agent 自动消费</td></tr>
<tr><td><code>selftest</code></td><td>跑内置示例并校验输出</td></tr>
<tr><td><code>version</code></td><td>版本号</td></tr>
</tbody></table></div>`);
  L.push('<p>元函数名是<b>保留字</b>，优先级高于同名业务函数，保证任何情况下都能自发现。（因此 <code>file_tool</code> 的列目录函数叫 <code>ls</code> 而不是 <code>list</code>。）</p>');

  L.push(h(2, '目录结构', 'layout'));
  L.push(codeBlock(`ai-tools/
├── bin/                     13 个可执行入口（12 工具 + ai-tools 聚合器）
├── lib/
│   ├── cli.js               统一 CLI 引擎：参数解析、元函数、退出码、原子写入
│   ├── desc.js              DESC/1.0 读取器（三层视图）
│   ├── errors.js            统一错误与退出码
│   ├── num.js               数值工具（格式化、分位数、牛顿法求根…）
│   ├── table.js             零依赖对齐表格（含 CJK 宽度）
│   └── png.js               零依赖 PNG 编解码
├── tools/<name>_tool/       12 个工具，每个导出 { name, functions }
├── scripts/                 索引/文档生成器与自检脚本
├── test/                    node:test 单元测试
└── doc/                     本说明书（由 npm run doc 生成）`, 'text'));

  L.push(h(2, '开发', 'dev'));
  L.push(codeBlock('npm test           # node --test，单元测试\nnpm run selftest   # 跑全部工具的内置示例\nnpm run smoke      # 端到端冒烟\nnpm run index      # 重新生成 INDEX.md / MANIFEST.json\nnpm run doc        # 重新生成 doc/ 说明书', 'bash'));

  return page({
    title: '总览',
    active: 'index.html',
    body: L.join('\n'),
  });
}

/* ------------------------------------------------------------------ */
/* 页面 2/3：由 Markdown 渲染的规范与贡献指南                            */
/* ------------------------------------------------------------------ */

function buildMarkdownPage(file, title, active, intro) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const items = toc(src).filter((t) => t.level >= 2);
  const L = [];
  L.push(h(1, title, 'top'));
  if (intro) L.push(`<p class="lead">${intro}</p>`);
  if (items.length) {
    L.push('<div class="page-toc"><div class="t">目录</div>');
    for (const t of items) L.push(`<a href="#${t.id}" style="margin-left:${(t.level - 2) * 14}px">${escapeHtml(t.text)}</a>`);
    L.push('</div>');
  }
  L.push(rewriteLinks(renderMarkdown(src, { headingLevel: 1 })));
  return page({ title, active, body: L.join('\n') });
}

/* ------------------------------------------------------------------ */
/* 页面 4：全部函数总表                                                  */
/* ------------------------------------------------------------------ */

function buildFunctions() {
  const L = [];
  L.push(h(1, `全部函数（${FN_TOTAL}）`, 'top'));
  L.push('<p class="lead">跨 12 个工具的全部函数。<code>input.desc</code> / <code>output.desc</code> 两列是真实契约示例——它们同时也是每个工具 <code>selftest</code> 的回归用例。</p>');
  L.push('<input class="search" type="search" data-search placeholder="搜索函数名、说明或工具，例如：add / 对比度 / 复利 / csv">');
  L.push(`<p class="count" data-count>共 ${FN_TOTAL} 个函数</p>`);

  let t = '<div class="table-wrap"><table><thead><tr><th>工具</th><th>分组</th><th>函数</th><th>说明</th><th>input.desc</th><th>output.desc</th></tr></thead><tbody>';
  for (const tool of tools) {
    for (const f of tool.functions) {
      const inEx = f.input && f.input.example !== undefined ? String(f.input.example) : '';
      const outEx = f.output && f.output.example !== undefined ? String(f.output.example) : '';
      t += `<tr data-fn="${escapeHtml(tool.name + ' ' + f.name + ' ' + (f.group || '') + ' ' + (f.summary || ''))}">`
        + `<td><a href="tools/${tool.name}.html#${f.name}">${escapeHtml(tool.name)}</a></td>`
        + `<td>${escapeHtml(f.group || '')}</td>`
        + `<td><code>${escapeHtml(f.name)}</code></td>`
        + `<td>${escapeHtml(f.summary || '')}</td>`
        + `<td>${inEx ? `<code>${escapeHtml(inEx).replace(/\n/g, ' ⏎ ')}</code>` : '<span style="opacity:.45">—</span>'}</td>`
        + `<td>${outEx ? `<code>${escapeHtml(outEx).replace(/\n/g, ' ⏎ ')}</code>` : '<span style="opacity:.45">—</span>'}</td>`
        + '</tr>';
    }
  }
  t += '</tbody></table></div>';
  L.push(t);
  return page({ title: '全部函数', active: 'functions.html', body: L.join('\n') });
}

/* ------------------------------------------------------------------ */
/* 页面 5：每个工具一页                                                  */
/* ------------------------------------------------------------------ */

function buildTool(t, idx) {
  const L = [];
  L.push(h(1, t.name, 'top'));
  L.push(`<p class="lead">${escapeHtml(t.title || t.name)} — ${escapeHtml(t.summary || '')}</p>`);
  L.push('<div class="chips">');
  L.push(`  <span class="chip">${escapeHtml(t.category || '通用')}</span>`);
  L.push(`  <span class="chip"><b>${t.functions.length}</b> 个函数</span>`);
  L.push(`  <span class="chip">用法 <code>${escapeHtml(t.name)} &lt;function&gt; -i input.desc -o output.desc</code></span>`);
  L.push('</div>');

  L.push(codeBlock(`${t.name} list            # 列出全部函数\n${t.name} help <fn>      # 看某个函数的输入输出契约\n${t.name} schema <fn>    # JSON 机器契约\n${t.name} selftest       # 跑内置示例`, 'bash'));

  // 函数目录
  const byGroup = new Map();
  for (const f of t.functions) {
    const g = f.group || '其他';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(f);
  }
  L.push('<div class="page-toc"><div class="t">本页函数</div>');
  for (const [g, fns] of byGroup) {
    for (const f of fns) L.push(`<a href="#${f.name}">${escapeHtml(g)} · ${escapeHtml(f.name)}</a>`);
  }
  L.push('</div>');

  if (t.functions.length >= 10) {
    L.push(`<input class="search" type="search" data-search placeholder="在 ${escapeHtml(t.name)} 的 ${t.functions.length} 个函数中搜索…">`);
  }
  L.push(`<p class="count" data-count>共 ${t.functions.length} 个函数</p>`);

  for (const [g, fns] of byGroup) {
    L.push(`<div data-group>`);
    L.push(h(2, `${escapeHtml(g)}（${fns.length}）`, 'g-' + encodeURIComponent(g)));
    L.push('<div class="fn-grid">');
    for (const f of fns) L.push(fnCard(t, f));
    L.push('</div>');
    L.push('</div>');
  }

  // 上一个 / 下一个工具
  const prev = tools[idx - 1];
  const next = tools[idx + 1];
  L.push('<div class="prevnext">');
  L.push(prev ? `<span>← <a href="${prev.name}.html">${escapeHtml(prev.name)}</a></span>` : '<span></span>');
  L.push(next ? `<span><a href="${next.name}.html">${escapeHtml(next.name)}</a> →</span>` : '<span></span>');
  L.push('</div>');

  return page({
    title: t.name,
    active: `tools/${t.name}.html`,
    base: '../',
    body: L.join('\n'),
  });
}

/* ------------------------------------------------------------------ */
/* 主流程                                                               */
/* ------------------------------------------------------------------ */

fs.mkdirSync(path.join(docDir, 'tools'), { recursive: true });

const written = [];
written.push(write('index.html', buildIndex()));
written.push(write('spec.html', buildMarkdownPage('SPEC.md', 'DESC/1.0 规范', 'spec.html',
  'DESC/1.0 是 ai-tools 的输入输出范式：一个 <code>.desc</code> 文件就是一段裸数据，怎么解释由 <code>tool + function</code> 的契约决定。')));
written.push(write('functions.html', buildFunctions()));
written.push(write('contributing.html', buildMarkdownPage('CONTRIBUTING.md', '贡献指南', 'contributing.html',
  '新增函数或工具前请先读这一页——评审标准不是「功能多强」，而是「AI 能不能稳定地生成输入、解析输出」。')));
tools.forEach((t, i) => written.push(write(`tools/${t.name}.html`, buildTool(t, i))));

process.stdout.write(`已生成 doc/ 说明书：${written.length} 个页面（${tools.length} 个工具 / ${FN_TOTAL} 个函数）\n`);
