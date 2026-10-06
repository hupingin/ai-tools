'use strict';

/**
 * 极简 Markdown -> HTML 渲染器（零依赖，够用即可）。
 *
 * 只支持文档里真正用到的语法：
 *   标题 #~###### / 围栏代码块 ``` / 水平线 --- / 引用 >
 *   表格 | a | b | / 无序列表 - * + / 有序列表 1.
 *   行内：`code` **bold** *em* [text](url)  <br>
 * 不追求 CommonMark 完整性——这是给自家 SPEC.md / CONTRIBUTING.md 用的。
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 行内语法。代码段先抽出来占位，避免被粗体/链接规则二次处理 */
function inline(s) {
  const codes = [];
  let t = String(s).replace(/`([^`]+)`/g, (m, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });
  t = escapeHtml(t);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => `<a href="${url}">${text}</a>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${escapeHtml(codes[Number(i)])}</code>`);
  return t;
}

/** 生成锚点 id：保留中英文与数字，其余压成短横线 */
function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[`*_[\]()]/g, '')
    .trim()
    .replace(/[^\w一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sec';
}

function isBlockStart(line) {
  return /^```/.test(line)
    || /^#{1,6}\s/.test(line)
    || /^\s*(---|\*\*\*|___)\s*$/.test(line)
    || /^>/.test(line)
    || /^\s*\|/.test(line)
    || /^\s*[-*+]\s+/.test(line)
    || /^\s*\d+\.\s+/.test(line)
    || line.trim() === '';
}

function splitRow(line) {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
}

function renderMarkdown(src, opts = {}) {
  const headingLevel = opts.headingLevel || 0; // 0=不降级；1=把 # 当 ##，用于嵌入页面
  const lines = String(src).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 围栏代码块
    if (/^```/.test(line.trimStart())) {
      const lang = line.trim().slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trimStart())) buf.push(lines[i++]);
      i++; // 收尾围栏
      out.push(`<pre class="code"${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lv = Math.min(6, h[1].length + headingLevel);
      const id = slug(h[2]);
      out.push(`<h${lv} id="${id}" class="anchor"><a href="#${id}">${inline(h[2])}</a></h${lv}>`);
      i++;
      continue;
    }

    // 水平线
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    // 引用
    if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'), opts)}</blockquote>`);
      continue;
    }

    // 表格
    if (/^\s*\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
      if (rows.length >= 2) {
        const head = rows[0];
        const body = rows.slice(2); // 跳过 |---|---| 分隔行
        let t = '<div class="table-wrap"><table><thead><tr>';
        for (const c of head) t += `<th>${inline(c)}</th>`;
        t += '</tr></thead><tbody>';
        for (const r of body) {
          t += '<tr>';
          for (let k = 0; k < head.length; k++) t += `<td>${inline(r[k] === undefined ? '' : r[k])}</td>`;
          t += '</tr>';
        }
        out.push(t + '</tbody></table></div>');
      }
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*[-*+]\s+/, ''));
      let t = '<ul>';
      for (const b of buf) t += `<li>${inline(b)}</li>`;
      out.push(t + '</ul>');
      continue;
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
      let t = '<ol>';
      for (const b of buf) t += `<li>${inline(b)}</li>`;
      out.push(t + '</ol>');
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    // 段落：连续非空且不是新块的行
    const buf = [];
    while (i < lines.length && !isBlockStart(lines[i])) buf.push(lines[i++]);
    if (buf.length) out.push(`<p>${inline(buf.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }

  return out.join('\n');
}

/** 抽取一级/二级标题，用于生成目录 */
function toc(src) {
  const out = [];
  let inFence = false;
  for (const line of String(src).replace(/\r\n/g, '\n').split('\n')) {
    if (/^```/.test(line.trimStart())) { inFence = !inFence; continue; }
    if (inFence) continue;
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) out.push({ level: h[1].length, text: h[2].replace(/[`*]/g, '').trim(), id: slug(h[2]) });
  }
  return out;
}

module.exports = { renderMarkdown, escapeHtml, slug, toc, inline };
