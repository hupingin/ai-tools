/* ai-tools 文档站交互 —— 零依赖：主题切换、复制、函数搜索 */
(function () {
  'use strict';

  /* ---- 主题：跟随系统，可手动切换并记住 ---- */
  var KEY = 'ai-tools-doc-theme';

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = document.querySelector('[data-theme-toggle]');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☾' : '☀';
      btn.title = theme === 'dark' ? '切换到亮色' : '切换到暗色';
    }
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* 隐私模式下忽略 */ }
  apply(saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (err) { /* ignore */ }
  });

  /* ---- 代码块复制按钮 ---- */
  document.querySelectorAll('pre.code').forEach(function (pre) {
    var btn = document.createElement('button');
    btn.className = 'copy';
    btn.type = 'button';
    btn.textContent = '复制';
    btn.addEventListener('click', function () {
      var text = pre.querySelector('code') ? pre.querySelector('code').textContent : pre.textContent;
      var done = function () {
        btn.textContent = '已复制';
        btn.classList.add('done');
        setTimeout(function () { btn.textContent = '复制'; btn.classList.remove('done'); }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (err) { btn.textContent = '复制失败'; }
        document.body.removeChild(ta);
      }
    });
    pre.appendChild(btn);
  });

  /* ---- 函数搜索：按名称/说明/工具过滤 ---- */
  var input = document.querySelector('[data-search]');
  if (input) {
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-fn]'));
    var counter = document.querySelector('[data-count]');
    var total = items.length;

    function run() {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (el) {
        var hay = (el.getAttribute('data-fn') || '') + ' ' + (el.textContent || '');
        var hit = !q || hay.toLowerCase().indexOf(q) !== -1;
        el.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      // 分组标题在没有任何命中时一并隐藏
      document.querySelectorAll('[data-group]').forEach(function (g) {
        var any = g.querySelectorAll('[data-fn]');
        var visible = 0;
        any.forEach(function (el) { if (el.style.display !== 'none') visible++; });
        g.style.display = visible ? '' : 'none';
      });
      if (counter) counter.textContent = q ? ('匹配 ' + shown + ' / ' + total + ' 个函数') : ('共 ' + total + ' 个函数');
    }

    input.addEventListener('input', run);
    run();
  }

  /* ---- 当前页高亮侧边栏 ---- */
  var here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.side-link').forEach(function (a) {
    if (a.getAttribute('href').split('/').pop() === here) a.classList.add('on');
  });
})();
