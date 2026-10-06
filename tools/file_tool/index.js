'use strict';

const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { usageError, inputError, runtimeError } = require('../../lib/errors');

const L = (ctx) => ctx.desc.lines({ keepEmpty: true, trim: false });
const P0 = (ctx) => {
  const l = ctx.desc.lines();
  if (!l.length) throw inputError('input.desc 为空，第 1 行应为路径');
  return l[0];
};
const P1 = (ctx, n) => {
  const l = ctx.desc.lines();
  if (l.length < n) throw inputError(`需要 ${n} 行输入`);
  return l.slice(0, n);
};

function mk(name, group, summary, o) {
  return {
    name, group, summary,
    args: o.args || [],
    input: { kind: 'text', layout: o.inLayout || 'paths', desc: o.inDesc || '第 1 行为路径', example: o.inExample },
    output: { layout: o.outLayout || 'text', desc: o.outDesc || '', example: o.outExample },
    examples: o.outExample !== undefined
      ? [{ input: String(o.inExample ?? ''), opts: o.exOpts, expect: String(o.outExample) }] : [],
    run: o.run,
  };
}

async function walkDir(dir, { maxDepth = Infinity, filesOnly = false } = {}) {
  const out = [];
  const rec = async (d, depth) => {
    let entries;
    try {
      entries = await fsp.readdir(d, { withFileTypes: true });
    } catch (e) {
      if (e.code === 'EACCES' || e.code === 'ENOENT') return;
      throw e;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!filesOnly) out.push({ path: p, dir: true, depth });
        if (depth + 1 < maxDepth) await rec(p, depth + 1);
      } else {
        out.push({ path: p, dir: false, depth });
      }
    }
  };
  await rec(dir, 0);
  return out;
}

async function statOrThrow(p) {
  try {
    return await fsp.stat(p);
  } catch (e) {
    if (e.code === 'ENOENT') throw inputError(`路径不存在: ${p}`);
    throw runtimeError(`无法访问 ${p}: ${e.message}`);
  }
}

const functions = [
  /* ---------- 读写 ---------- */
  mk('read', '读写', '读取文本文件内容', {
    inDesc: '文件路径', outDesc: '文件内容',
    run: async (ctx) => {
      const p = P0(ctx);
      await statOrThrow(p);
      return await fsp.readFile(p, 'utf8');
    },
  }),
  mk('write', '读写', '写入文件：第 1 行为路径，其余为内容', {
    inDesc: '第 1 行路径，第 2 行起为文件内容', outDesc: '写入结果',
    run: async (ctx) => {
      const lines = L(ctx);
      if (!lines.length) throw inputError('第 1 行应为目标路径');
      const p = lines[0];
      const content = lines.slice(1).join('\n');
      await fsp.mkdir(path.dirname(path.resolve(p)), { recursive: true });
      await fsp.writeFile(p, content, 'utf8');
      return `ok ${Buffer.byteLength(content, 'utf8')} bytes -> ${p}`;
    },
  }),
  mk('append', '读写', '追加内容：第 1 行为路径，其余为内容', {
    inDesc: '第 1 行路径，第 2 行起为追加内容',
    run: async (ctx) => {
      const lines = L(ctx);
      if (!lines.length) throw inputError('第 1 行应为目标路径');
      const p = lines[0];
      const content = lines.slice(1).join('\n');
      await fsp.appendFile(p, content, 'utf8');
      return `ok ${Buffer.byteLength(content, 'utf8')} bytes -> ${p}`;
    },
  }),
  mk('replace_in_place', '读写', '就地替换：第 1 行路径，第 2 行查找，第 3 行替换', {
    inDesc: '第 1 行路径，第 2 行目标串，第 3 行替换为',
    args: [{ long: '--regex', flag: true, desc: '把查找串当正则' }, { long: '--flags', default: 'g', desc: '正则修饰符' }],
    outDesc: '替换次数',
    run: async (ctx) => {
      const [p, from, to] = P1(ctx, 3);
      const src = await fsp.readFile(p, 'utf8');
      let count = 0;
      let out;
      if (ctx.opts.regex) {
        const re = new RegExp(from, ctx.opts.flags || 'g');
        out = src.replace(re, () => { count++; return to; });
      } else {
        count = src.split(from).length - 1;
        out = count ? src.split(from).join(to) : src;
      }
      await fsp.writeFile(p, out, 'utf8');
      return String(count);
    },
  }),

  /* ---------- 文件操作 ---------- */
  mk('copy', '文件操作', '复制：第 1 行源，第 2 行目标', {
    inDesc: '第 1 行源路径，第 2 行目标路径',
    run: async (ctx) => {
      const [src, dst] = P1(ctx, 2);
      await statOrThrow(src);
      await fsp.mkdir(path.dirname(path.resolve(dst)), { recursive: true });
      await fsp.copyFile(src, dst);
      return `ok ${src} -> ${dst}`;
    },
  }),
  mk('move', '文件操作', '移动/重命名：第 1 行源，第 2 行目标', {
    inDesc: '第 1 行源路径，第 2 行目标路径',
    run: async (ctx) => {
      const [src, dst] = P1(ctx, 2);
      await statOrThrow(src);
      await fsp.mkdir(path.dirname(path.resolve(dst)), { recursive: true });
      await fsp.rename(src, dst);
      return `ok ${src} -> ${dst}`;
    },
  }),
  mk('delete', '文件操作', '删除文件或目录，每行一个路径', {
    inDesc: '每行一个路径',
    args: [{ short: '-r', long: '--recursive', flag: true, desc: '递归删除目录' }],
    outDesc: '已删除数量',
    run: async (ctx) => {
      const paths = ctx.desc.lines();
      if (!paths.length) throw inputError('至少需要一个路径');
      let n = 0;
      for (const p of paths) {
        try {
          await fsp.rm(p, { recursive: !!ctx.opts.recursive, force: false });
          n++;
        } catch (e) {
          if (e.code === 'ENOENT') continue;
          throw runtimeError(`删除失败 ${p}: ${e.message}`, e.code === 'ERR_FS_EISDIR' ? '删除目录请加 -r' : null);
        }
      }
      return String(n);
    },
  }),
  mk('mkdir', '文件操作', '创建目录，每行一个路径', {
    inDesc: '每行一个目录路径', outDesc: '创建数量',
    run: async (ctx) => {
      const paths = ctx.desc.lines();
      if (!paths.length) throw inputError('至少需要一个目录路径');
      let n = 0;
      for (const p of paths) { await fsp.mkdir(p, { recursive: true }); n++; }
      return String(n);
    },
  }),
  mk('touch', '文件操作', '创建空文件或更新时间戳，每行一个路径', {
    inDesc: '每行一个文件路径', outDesc: '处理数量',
    run: async (ctx) => {
      const paths = ctx.desc.lines();
      if (!paths.length) throw inputError('至少需要一个文件路径');
      const now = new Date();
      let n = 0;
      for (const p of paths) {
        await fsp.mkdir(path.dirname(path.resolve(p)), { recursive: true });
        try { await fsp.utimes(p, now, now); } catch { await fsp.writeFile(p, '', 'utf8'); }
        n++;
      }
      return String(n);
    },
  }),

  /* ---------- 查询 ---------- */
  mk('exists', '查询', '路径是否存在，输出 true/false', {
    inDesc: '路径', outLayout: 'boolean',
    run: async (ctx) => {
      try { await fsp.access(P0(ctx)); return 'true'; } catch { return 'false'; }
    },
  }),
  mk('stat', '查询', '输出文件属性', {
    inDesc: '路径', outLayout: 'kv', outDesc: '每行一项：键 值',
    run: async (ctx) => {
      const p = P0(ctx);
      const s = await statOrThrow(p);
      return [
        `path ${p}`,
        `type ${s.isDirectory() ? 'dir' : s.isFile() ? 'file' : 'other'}`,
        `size ${s.size}`,
        `mtime ${new Date(s.mtimeMs).toISOString()}`,
        `atime ${new Date(s.atimeMs).toISOString()}`,
        `mode ${(s.mode & 0o777).toString(8)}`,
      ].join('\n');
    },
  }),
  mk('size', '查询', '字节大小', {
    inDesc: '路径', outLayout: 'number',
    run: async (ctx) => String((await statOrThrow(P0(ctx))).size),
  }),
  mk('lines', '查询', '文本行数', {
    inDesc: '文件路径', outLayout: 'number',
    run: async (ctx) => {
      const s = await fsp.readFile(P0(ctx), 'utf8');
      if (s === '') return '0';
      return String(s.replace(/\n$/, '').split('\n').length);
    },
  }),
  mk('hash', '查询', '文件哈希，--algo 指定算法', {
    inDesc: '文件路径', outLayout: 'string',
    args: [{ long: '--algo', default: 'sha256', desc: 'md5|sha1|sha256|sha512' }],
    run: async (ctx) => {
      const p = P0(ctx);
      const algo = ctx.opts.algo || 'sha256';
      const h = crypto.createHash(algo);
      const { createReadStream } = require('node:fs');
      const stream = createReadStream(p);
      for await (const chunk of stream) h.update(chunk);
      return h.digest('hex');
    },
  }),

  /* ---------- 目录 ---------- */
  mk('ls', '目录', '列出目录条目，--all 含隐藏，--long 带大小', {
    inDesc: '目录路径', outLayout: 'rows', outDesc: '每行一个条目',
    args: [{ short: '-a', long: '--all', flag: true, desc: '包含以 . 开头的条目' }, { short: '-l', long: '--long', flag: true, desc: '附带类型与大小' }],
    run: async (ctx) => {
      const dir = P0(ctx);
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      const out = [];
      for (const e of entries) {
        if (!ctx.opts.all && e.name.startsWith('.')) continue;
        if (!ctx.opts.long) { out.push(e.name); continue; }
        let size = '';
        try {
          const s = await fsp.stat(path.join(dir, e.name));
          size = String(s.size);
        } catch { size = '-'; }
        out.push(`${e.isDirectory() ? 'd' : '-'} ${size} ${e.name}`);
      }
      return out.join('\n');
    },
  }),
  mk('find', '目录', '在目录中查找，第 1 行目录，第 2 行关键字（可为 --ext 后缀）', {
    inDesc: '第 1 行目录，第 2 行名称关键字（--regex 时为正则）',
    args: [{ long: '--regex', flag: true, desc: '关键字按正则匹配' }, { long: '--ext', desc: '按后缀过滤，如 .js' }, { short: '-d', long: '--depth', type: 'number', desc: '最大递归深度' }],
    outLayout: 'rows', outDesc: '每行一个匹配路径',
    run: async (ctx) => {
      const l = ctx.desc.lines();
      const dir = l[0];
      const kw = l[1] === undefined ? '' : l[1];
      if (!dir) throw inputError('第 1 行应为目录路径');
      const items = await walkDir(dir, { maxDepth: ctx.opts.depth === undefined ? Infinity : ctx.opts.depth });
      const test = (name) => {
        if (ctx.opts.ext) return name.toLowerCase().endsWith(String(ctx.opts.ext).toLowerCase());
        if (!kw) return true;
        return ctx.opts.regex ? new RegExp(kw).test(name) : name.includes(kw);
      };
      return items.filter((it) => test(path.basename(it.path))).map((it) => it.path).join('\n');
    },
  }),
  mk('tree', '目录', '输出目录树，--depth 限制层级', {
    inDesc: '目录路径', outLayout: 'text', outDesc: '缩进树形结构',
    args: [{ short: '-d', long: '--depth', type: 'number', default: 3, desc: '最大层级' }],
    run: async (ctx) => {
      const dir = P0(ctx);
      const items = await walkDir(dir, { maxDepth: ctx.opts.depth === undefined ? 3 : ctx.opts.depth });
      const lines = [dir];
      for (const it of items) {
        lines.push(`${'  '.repeat(it.depth + 1)}${path.basename(it.path)}${it.dir ? '/' : ''}`);
      }
      return lines.join('\n');
    },
  }),
  mk('dirsize', '目录', '统计目录下文件数、目录数与总字节', {
    inDesc: '目录路径', outLayout: 'kv', outDesc: '每行一项：键 值',
    run: async (ctx) => {
      const dir = P0(ctx);
      const items = await walkDir(dir);
      let bytes = 0, files = 0, dirs = 0;
      for (const it of items) {
        if (it.dir) { dirs++; continue; }
        files++;
        try { bytes += (await fsp.stat(it.path)).size; } catch { /* ignore */ }
      }
      return `files ${files}\ndirs ${dirs}\nbytes ${bytes}`;
    },
  }),
  mk('grep', '目录', '在文件中搜索，第 1 行文件路径，第 2 行关键字', {
    inDesc: '第 1 行文件路径，第 2 行搜索关键字',
    args: [{ long: '--regex', flag: true, desc: '关键字按正则匹配' }, { short: '-i', long: '--ignore-case', flag: true, desc: '忽略大小写' }, { short: '-n', long: '--max', type: 'number', desc: '最多输出行数' }],
    outLayout: 'rows', outDesc: '每行 "行号:内容"',
    run: async (ctx) => {
      const l = ctx.desc.lines();
      if (l.length < 2) throw inputError('需要 2 行：文件路径 与 搜索关键字');
      const [file, kw] = l;
      const src = await fsp.readFile(file, 'utf8');
      const lines = src.split('\n');
      const flags = ctx.opts.ignore_case ? 'i' : '';
      const re = ctx.opts.regex ? new RegExp(kw, flags) : null;
      const needle = ctx.opts.ignore_case ? kw.toLowerCase() : kw;
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const hit = re ? re.test(line) : (ctx.opts.ignore_case ? line.toLowerCase().includes(needle) : line.includes(needle));
        if (hit) out.push(`${i + 1}:${line}`);
        if (ctx.opts.max !== undefined && out.length >= ctx.opts.max) break;
      }
      return out.join('\n');
    },
  }),
];

module.exports = {
  name: 'file_tool',
  title: '文件系统工具',
  category: '通用 / 系统',
  summary: '文件读写、复制移动删除、属性查询、目录列举查找、哈希与全文搜索',
  version: require('../../package.json').version,
  functions,
};
