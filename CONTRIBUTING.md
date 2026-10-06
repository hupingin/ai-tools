# 贡献指南

仓库：<https://github.com/hupingin/ai-tools>

欢迎一起「重新造轮子」。这个仓库的目标很窄也很硬：**让 AI 能用一套统一范式调用所有功能**。所以新增代码的评审标准不是「功能多强」，而是「AI 能不能稳定地生成输入、解析输出」。

---

## 三条底线

1. **零第三方依赖**。只用 Node 内置模块（`node:fs`、`node:crypto`、`node:zlib`、`node:path`、`node:test` …）。
   `package.json` 的 `dependencies` 和 `devDependencies` 必须保持 `{}`。
2. **统一范式**。调用永远是 `xxx_tool <function> -i input.desc -o output.desc`。
3. **示例即测试**。每个函数的 `examples` 同时充当文档、AI 的 few-shot 样本和 `selftest` 的回归用例。
   没有 `examples` 的函数，等于没有契约。

---

## 新增一个函数（最常见）

编辑 `tools/<name>_tool/index.js`，往 `functions` 数组里加一项：

```js
{
  name: 'hypot',                    // 小写 + 下划线，不得占用保留名
  group: '几何',                     // 用于 list 分组
  summary: '直角三角形斜边长度',      // 一句话，AI 靠它选函数
  args: [                            // 可选：额外命令行选项
    { short: '-n', long: '--digits', type: 'number', default: 2, desc: '保留小数位' },
  ],
  input: {
    kind: 'values',                  // values|text|json|csv|rows|kv|paths|png-or-path|none
    layout: 'values',
    count: 2,                        // 或 min: 1（至少一个）
    desc: '两个直角边长度 a b',
    example: '3 4',
  },
  output: {
    layout: 'number',
    desc: '斜边长度',
    example: 5,
  },
  examples: [
    { input: '3 4', expect: '5' },
    { input: '5 12', expect: '13', opts: { digits: 2 } },
  ],
  run: (ctx) => {
    const [a, b] = ctx.desc.numbers({ count: 2 });
    return Math.hypot(a, b);
  },
}
```

然后：

```bash
npm run selftest     # 你的 examples 会被自动执行并校验
npm run index        # 重新生成 INDEX.md 与 MANIFEST.json
```

### `ctx` 里有什么

| 字段 | 说明 |
| --- | --- |
| `ctx.desc` | DESC 读取器，见下 |
| `ctx.opts` | 解析后的选项（`--digits` → `ctx.opts.digits`）；已填默认值 |
| `ctx.positional` | 位置参数 |
| `ctx.buf` | 二进制输入（`input.binary: true` 时） |
| `ctx.inPath` | 实际输入文件来源（stdin 时为 `'stdin'`） |
| `ctx.sep` | `--sep` 指定的分隔符 |
| `ctx.tool` / `ctx.fn` | 工具与当前函数对象 |

### `desc` 的三层读取视图

同一份裸数据，按需要取用：

```js
ctx.desc.payload()            // L0 原文       "1 2"
ctx.desc.lines()              // L1 行         ["1 2"]
ctx.desc.tokens()             // L2 字段       ["1", "2"]
ctx.desc.numbers({ count: 2 })// L2 数字       [1, 2]
ctx.desc.strings()            // L2 字符串
ctx.desc.kv()                 // L2 键值（每行 "k v"）
ctx.desc.json()               // 整段 JSON
ctx.desc.isEmpty()
```

> `numbers({ count })` / `numbers({ min, max })` 会在数量不符时抛出 **INPUT(2)** 错误，不用自己校验。

### 错误处理

永远抛 `lib/errors.js` 的工厂函数，**不要 `new`**：

```js
const { inputError, usageError, runtimeError, unknownError } = require('../../lib/errors');

throw inputError('第 2 个值必须是正数', 'input.desc 形如: 3 4');
throw usageError('--digits 不能为负');
throw runtimeError('求解不收敛');
```

五个退出码：0 OK / 1 USAGE / 2 INPUT / 3 RUNTIME / 4 UNKNOWN。

### 输出

`run` 可以返回：

- 字符串 → 原样写入（自动补尾随 `\n`）
- 数字 → `String(n)`
- 对象/数组 → `JSON.stringify(v, null, 2)`
- `Buffer` → 二进制原样写入

浮点噪声请用 `lib/num.js` 的 `fmt()`：`0.1 + 0.2` → `"0.3"` 而不是 `"0.30000000000000004"`。

---

## 新增一个工具

1. 建目录 `tools/<name>_tool/index.js`，导出：

   ```js
   module.exports = {
     name: '<name>_tool',
     title: '中文标题',
     category: '行业 / 领域',     // 如 '金融 / 财务'
     summary: '一句话说明',
     version: require('../../package.json').version,
     functions,
   };
   ```

2. 建 `bin/<name>_tool.js`（三行模板）：

   ```js
   #!/usr/bin/env node
   'use strict';
   const { main } = require('../lib/cli');
   main(require('../tools/<name>_tool'));
   ```

3. 在 `registry.js` 的 `TOOLS` 数组加一行。
4. 在 `package.json` 的 `bin` 加一条。
5. `npm run index` 重新生成索引。

### 硬约束

- 工具名以 `_tool` 结尾。
- 函数名**不得**占用保留名：`list` / `functions` / `help` / `schema` / `selftest` / `version`。
  这些是元函数，优先级高于同名业务函数（`file_tool` 的列目录因此叫 `ls` 而不是 `list`）。
- 每个函数都要有 `summary`、`group`、`input`、`output`、`run`。
- `input.kind: 'none'` 表示不需要 `input.desc`（如 `crypto_tool uuid`）。

---

## 测试

```bash
npm test           # node --test：DESC 解析、CLI 引擎、PNG 编解码、跨工具契约、算法正确性
npm run selftest   # 跑全部工具的内置示例
npm run smoke      # 端到端冒烟 14 项（进程内驱动 lib/cli.run）
npm run doc        # 重新生成 doc/ 说明书
npm run doc:check  # 校验 doc/ 无死链、无 undefined 残留
```

`doc/` 下的 HTML 说明书是**生成物**，改了任何工具都必须重跑 `npm run doc`——CI 会用 `git diff --exit-code -- doc/` 挡住忘记生成的情况。

- 给 `lib/` 下的新模块写单元测试，放 `test/<module>.test.js`。
- `test/contract.test.js` 会自动校验**所有**工具：`_tool` 后缀、名字唯一、不撞保留名、必填字段齐全、schema 可序列化、selftest 全绿。所以它会自动覆盖你新加的工具——别破坏它。
- 修改函数后如果 `selftest` 红了，先怀疑**你写的期望值算错了**，再怀疑算法。这个坑已经踩过很多次（cv、协方差、pmt、base64url 方向…）。

---

## 提交前检查清单

- [ ] `npm test` / `npm run selftest` / `npm run smoke` 全绿
- [ ] `npm run index` 已执行，`INDEX.md` 与 `MANIFEST.json` 已同步更新
- [ ] `npm run doc` 与 `npm run doc:check` 已执行，`doc/` 已同步更新
- [ ] 新函数有 `examples`，且期望值是**手算或权威工具验证过**的
- [ ] 没有引入第三方依赖
- [ ] 没有新增文件包含 NUL 字节或多行字符串字面量（Windows 下 shell 编辑容易中招，可用 `grep -c $'\0' file` 自查）
- [ ] 错误信息带 `hint`，告诉 AI 该怎么改

---

## 代码风格

- `'use strict'`；CommonJS（`require` / `module.exports`）。
- 2 空格缩进，分号，单引号。
- 注释用中文，说明「为什么」而不是「是什么」。
- 面向 AI 的文本优先：输出稳定、可解析、不夹带 ANSI 颜色码。

---

## 想加的行业方向

已落地：数学、统计、文本、JSON、CSV、时间、文件、加密、单位、颜色、图像、金融。

候选：音频/信号处理、地理/GIS、网络/HTTP、正则、压缩/归档、数据库、Markdown、HTTP 状态、机器学习指标、日志分析……

欢迎到 <https://github.com/hupingin/ai-tools/issues> 开 issue 讨论——先定契约（`input.desc` 长什么样、`output.desc` 长什么样），再写代码。

Fork 后按上面的清单改，然后提 PR 到 `main` 分支；CI 会在 3 个操作系统 × Node 18/20/22 上跑完三套测试并校验索引未过期。
