'use strict';

const nodeCrypto = require('node:crypto');
const { usageError, inputError } = require('../../lib/errors');

const P = (ctx) => ctx.desc.payload();

function mk(name, group, summary, o) {
  return {
    name, group, summary,
    args: o.args || [],
    input: o.input || { kind: 'text', layout: 'text', desc: '待处理的文本', example: o.inExample },
    output: { layout: o.outLayout || 'text', desc: o.outDesc || '结果', example: o.outExample },
    examples: o.outExample !== undefined
      ? [{ input: String(o.inExample ?? ''), opts: o.exOpts, expect: String(o.outExample) }] : [],
    run: o.run,
  };
}

function hashFn(name, algo) {
  return mk(name, '哈希', `${algo} 摘要（十六进制）`, {
    inExample: 'abc',
    outExample: {
      md5: '900150983cd24fb0d6963f7d28e17f72',
      sha1: 'a9993e364706816aba3e25717850c26c9cd0d89d',
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      sha512: 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    }[algo],
    run: (ctx) => nodeCrypto.createHash(algo).update(P(ctx), 'utf8').digest('hex'),
  });
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

const need = (ctx, k, hint) => {
  const v = ctx.opts[k];
  if (v === undefined || v === null || v === '') throw new usageError(`缺少必填选项 --${k}`, hint);
  return v;
};

/** 把任意口令派生为 32 字节 AES-256 密钥 */
const deriveKey = (pass) => nodeCrypto.createHash('sha256').update(String(pass), 'utf8').digest();

const functions = [
  hashFn('md5', 'md5'),
  hashFn('sha1', 'sha1'),
  hashFn('sha256', 'sha256'),
  hashFn('sha512', 'sha512'),
  mk('crc32', '哈希', 'CRC32 校验值（十六进制 8 位）', {
    inExample: 'abc', outExample: '352441c2',
    run: (ctx) => crc32(Buffer.from(P(ctx), 'utf8')).toString(16).padStart(8, '0'),
  }),
  mk('hmac', '哈希', 'HMAC 签名：--key 密钥，--algo 算法', {
    args: [{ short: '-k', long: '--key', desc: '密钥（必填）' }, { long: '--algo', default: 'sha256', desc: 'sha1|sha256|sha512' }],
    inExample: 'abc', outExample: '9946dad4e00e913fc8be8e5d3f7e110a4a9e832f83fb09c345285d78638d8a0e', exOpts: { key: 'secret', algo: 'sha256' },
    run: (ctx) => nodeCrypto.createHmac(ctx.opts.algo || 'sha256', need(ctx, 'key')).update(P(ctx), 'utf8').digest('hex'),
  }),

  /* ---------- 编码 ---------- */
  mk('base64_encode', '编码', 'Base64 编码', {
    inExample: 'abc', outExample: 'YWJj',
    run: (ctx) => Buffer.from(P(ctx), 'utf8').toString('base64'),
  }),
  mk('base64_decode', '编码', 'Base64 解码', {
    inExample: 'YWJj', outExample: 'abc',
    run: (ctx) => Buffer.from(P(ctx).trim(), 'base64').toString('utf8'),
  }),
  mk('base64url_encode', '编码', 'Base64URL 编码（URL 安全）', {
    inExample: '???>>>', outExample: 'Pz8_Pj4-',
    run: (ctx) => Buffer.from(P(ctx), 'utf8').toString('base64url'),
  }),
  mk('base64url_decode', '编码', 'Base64URL 解码', {
    inExample: 'Pz8_Pj4-', outExample: '???>>>',
    run: (ctx) => Buffer.from(P(ctx).trim(), 'base64url').toString('utf8'),
  }),
  mk('hex_encode', '编码', '十六进制编码', {
    inExample: 'abc', outExample: '616263',
    run: (ctx) => Buffer.from(P(ctx), 'utf8').toString('hex'),
  }),
  mk('hex_decode', '编码', '十六进制解码', {
    inExample: '616263', outExample: 'abc',
    run: (ctx) => {
      const s = P(ctx).replace(/\s+/g, '');
      if (!/^[0-9a-fA-F]*$/.test(s) || s.length % 2 !== 0) throw inputError('不是合法的十六进制串');
      return Buffer.from(s, 'hex').toString('utf8');
    },
  }),
  mk('url_encode', '编码', 'URL 百分号编码', {
    inExample: 'a b&c', outExample: 'a%20b%26c',
    run: (ctx) => encodeURIComponent(P(ctx)),
  }),
  mk('url_decode', '编码', 'URL 百分号解码', {
    inExample: 'a%20b%26c', outExample: 'a b&c',
    run: (ctx) => decodeURIComponent(P(ctx).trim()),
  }),

  /* ---------- 随机 ---------- */
  mk('uuid', '随机', '生成 UUID v4（无需输入）', {
    input: { kind: 'none', layout: '(无需 input.desc)' },
    run: () => nodeCrypto.randomUUID(),
  }),
  mk('random_hex', '随机', '生成随机十六进制串，--n 字节数', {
    input: { kind: 'none', layout: '(无需 input.desc)' },
    args: [{ short: '-n', long: '--n', type: 'number', default: 16, desc: '随机字节数' }],
    run: (ctx) => nodeCrypto.randomBytes(Math.max(1, ctx.opts.n || 16)).toString('hex'),
  }),
  mk('random_string', '随机', '生成随机字符串，--n 长度，--charset 字符集', {
    input: { kind: 'none', layout: '(无需 input.desc)' },
    args: [{ short: '-n', long: '--n', type: 'number', default: 12, desc: '长度' }, { long: '--charset', default: 'A-Za-z0-9', desc: '字符范围简写或字面字符集' }],
    run: (ctx) => {
      const preset = {
        'A-Za-z0-9': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        alnum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        digits: '0123456789',
        hex: '0123456789abcdef',
        lower: 'abcdefghijklmnopqrstuvwxyz',
        upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      };
      const cs = preset[ctx.opts.charset] || ctx.opts.charset || preset['A-Za-z0-9'];
      const n = Math.max(1, ctx.opts.n || 12);
      const bytes = nodeCrypto.randomBytes(n);
      return Array.from(bytes).map((b) => cs[b % cs.length]).join('');
    },
  }),

  /* ---------- 对称加密 ---------- */
  mk('aes_encrypt', '对称加密', 'AES 加密：--key 口令，--mode gcm|cbc，输出 Base64（含 IV）', {
    args: [
      { short: '-k', long: '--key', desc: '口令（必填）' },
      { long: '--mode', default: 'gcm', desc: 'gcm|cbc' },
      { long: '--iv', desc: '十六进制 IV，缺省随机生成（GCM 12 字节 / CBC 16 字节）' },
    ],
    inExample: 'hello',
    run: (ctx) => {
      const key = deriveKey(need(ctx, 'key'));
      const mode = String(ctx.opts.mode || 'gcm').toLowerCase();
      const ivLen = mode === 'gcm' ? 12 : 16;
      const iv = ctx.opts.iv ? Buffer.from(String(ctx.opts.iv).replace(/\s+/g, ''), 'hex') : nodeCrypto.randomBytes(ivLen);
      if (iv.length !== ivLen) throw inputError(`${mode.toUpperCase()} 需要 ${ivLen} 字节 IV，收到 ${iv.length}`);
      if (mode === 'gcm') {
        const c = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
        const data = Buffer.concat([c.update(P(ctx), 'utf8'), c.final()]);
        return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
      }
      if (mode === 'cbc') {
        const c = nodeCrypto.createCipheriv('aes-256-cbc', key, iv);
        const data = Buffer.concat([c.update(P(ctx), 'utf8'), c.final()]);
        return Buffer.concat([iv, data]).toString('base64');
      }
      throw usageError(`不支持的模式: ${mode}`, '可用 gcm|cbc');
    },
  }),
  mk('aes_decrypt', '对称加密', 'AES 解密：--key 口令，--mode gcm|cbc', {
    args: [{ short: '-k', long: '--key', desc: '口令（必填）' }, { long: '--mode', default: 'gcm', desc: 'gcm|cbc' }],
    run: (ctx) => {
      const key = deriveKey(need(ctx, 'key'));
      const mode = String(ctx.opts.mode || 'gcm').toLowerCase();
      const buf = Buffer.from(P(ctx).trim(), 'base64');
      if (mode === 'gcm') {
        if (buf.length < 28) throw inputError('密文过短，不是合法的 GCM 载荷');
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const data = buf.subarray(28);
        const d = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
        d.setAuthTag(tag);
        return Buffer.concat([d.update(data), d.final()]).toString('utf8');
      }
      if (mode === 'cbc') {
        if (buf.length < 17) throw inputError('密文过短，不是合法的 CBC 载荷');
        const d = nodeCrypto.createDecipheriv('aes-256-cbc', key, buf.subarray(0, 16));
        return Buffer.concat([d.update(buf.subarray(16)), d.final()]).toString('utf8');
      }
      throw usageError(`不支持的模式: ${mode}`);
    },
  }),

  /* ---------- 口令派生 ---------- */
  mk('pbkdf2', '口令派生', 'PBKDF2 派生密钥，--salt --iterations --keylen --digest', {
    args: [
      { long: '--salt', default: 'ai-tools', desc: '盐值' },
      { long: '--iterations', type: 'number', default: 100000, desc: '迭代次数' },
      { long: '--keylen', type: 'number', default: 32, desc: '密钥字节数' },
      { long: '--digest', default: 'sha256', desc: '摘要算法' },
    ],
    inDesc: '口令明文',
    run: (ctx) => nodeCrypto.pbkdf2Sync(P(ctx), String(ctx.opts.salt || 'ai-tools'),
      Math.max(1, ctx.opts.iterations || 100000), Math.max(1, ctx.opts.keylen || 32), ctx.opts.digest || 'sha256').toString('hex'),
  }),
  mk('scrypt', '口令派生', 'scrypt 派生密钥，--salt --keylen', {
    args: [{ long: '--salt', default: 'ai-tools', desc: '盐值' }, { long: '--keylen', type: 'number', default: 32, desc: '密钥字节数' }],
    run: (ctx) => nodeCrypto.scryptSync(P(ctx), String(ctx.opts.salt || 'ai-tools'), Math.max(1, ctx.opts.keylen || 32)).toString('hex'),
  }),

  /* ---------- 古典密码 ---------- */
  mk('caesar', '古典密码', '凯撒移位，--shift 位移量（可为负）', {
    args: [{ short: '-s', long: '--shift', type: 'number', default: 13, desc: '位移量，默认 13' }],
    inExample: 'abc', outExample: 'nop', exOpts: { shift: 13 },
    run: (ctx) => {
      const s = ((Math.trunc(ctx.opts.shift || 13) % 26) + 26) % 26;
      return P(ctx).replace(/[a-zA-Z]/g, (c) => {
        const base = c <= 'Z' ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base);
      });
    },
  }),
  mk('rot13', '古典密码', 'ROT13（凯撒 13 位移）', {
    inExample: 'abc', outExample: 'nop',
    run: (ctx) => P(ctx).replace(/[a-zA-Z]/g, (c) => {
      const base = c <= 'Z' ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
    }),
  }),
  mk('xor', '古典密码', '按 --key 循环异或，输出十六进制', {
    args: [{ short: '-k', long: '--key', desc: '异或密钥字符串（必填）' }],
    inExample: 'abc', outExample: '202322', exOpts: { key: 'A' },
    run: (ctx) => {
      const k = Buffer.from(need(ctx, 'key'), 'utf8');
      const data = Buffer.from(P(ctx), 'utf8');
      const out = Buffer.alloc(data.length);
      for (let i = 0; i < data.length; i++) out[i] = data[i] ^ k[i % k.length];
      return out.toString('hex');
    },
  }),
];

module.exports = {
  name: 'crypto_tool',
  title: '编码加密工具',
  category: '安全 / 编码',
  summary: '哈希与 HMAC、Base64/Hex/URL 编解码、UUID 与随机数、AES 加解密、口令派生、古典密码',
  version: require('../../package.json').version,
  functions,
};
