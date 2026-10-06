# AI Tools 规范 v0.1（DESC/1.0）

本仓库是一组**面向 AI 的命令行工具**，目标是把「软件功能」统一成一种 AI 能稳定生成、稳定解析、稳定组合的调用范式。

设计信条只有三条：

1. **调用方式唯一**——所有工具都是 `xxx_tool <function> -i input.desc -o output.desc`。
2. **输入输出唯一**——所有数据都走 `.desc` 文件，内容是**极简裸数据**，不含信封、不含 key。
3. **契约可自发现**——任何工具都能用 `list` / `help` / `schema` 把「该往 input.desc 写什么、output.desc 会是什么」告诉调用方。

---

## 1. 调用范式

```
xxx_tool <function> [-i input.desc] [-o output.desc] [选项]
```

- 工具名统一以 `_tool` 结尾，按行业分门别类：`basic_math_tool`、`finance_tool`、`image_tool` …
- `<function>` 是工具内的一个具体功能（小写 + 下划线）。
- `-i / --input`：输入文件，**默认 `input.desc`**；`-` 表示读 stdin。
- `-o / --output`：输出文件，**默认 `output.desc`**；`-` 表示写 stdout。
- 选项既可以是 `--long value`、`--long=value`，也可以是 `-s value`；布尔开关直接写 `--flag`。

最小示例（就是本项目的第一个例子）：

```bash
printf '1 2' > input.desc
basic_math_tool add -i input.desc -o output.desc
cat output.desc   # => 3
```

因为 `-i/-o` 有默认值，上面三行也可以压成一行：

```bash
printf '1 2' > input.desc && basic_math_tool add && cat output.desc
```

---

## 2. DESC/1.0 —— 极简裸数据格式

`.desc` 文件就是**一段裸数据**，没有 JSON 信封、没有 `key: value`、没有类型标记。

**具体怎么解释这段裸数据，由 `tool + function` 的契约决定。**

这是本规范最核心的取舍：牺牲自描述性，换取 AI 生成输入和解析输出时的最小 token 消耗与最低出错率。自描述能力改由 **schema 元函数**提供（见第 4 节）。

### 2.1 通用规则

| 规则 | 说明 |
| --- | --- |
| 编码 | UTF-8 |
| 换行 | 写入统一 `\n`；读取时兼容 `\r\n` 与 `\r` |
| 注释 | **默认不解析**。仅当函数契约声明 `comments` 时才忽略 `#` 开头的行，或用 `--comments` 显式开启。这样 `text_tool` 处理含 `#` 的 Markdown 时才不会丢字节 |
| 空行 | 行视图默认忽略；原文视图保留 |
| 输出 | 函数返回什么就写什么；文本文件保证以 `\n` 结尾；写入采用「临时文件 + rename」的原子方式 |

### 2.2 三层读取视图

读取器把同一份裸数据暴露成三层，函数按需取用：

| 层 | API | "1 2" 的结果 |
| --- | --- | --- |
| L0 原文 | `desc.payload()` | `"1 2"` |
| L1 行 | `desc.lines()` | `["1 2"]` |
| L2 字段 | `desc.tokens()` / `desc.numbers()` | `["1","2"]` / `[1, 2]` |

同一份数据用空格分隔还是换行分隔，**结果完全等价**：

```
1 2      等价于      1
                     2
```

这条等价性让 AI 不必纠结排版，是「面向 AI」的关键设计。

### 2.3 常见输入布局

| 布局 | 说明 | 例子 |
| --- | --- | --- |
| `values` | 一串空白/换行分隔的值 | `basic_math_tool sum` ← `1 2 3 4` |
| `text` | 整段文本即负载 | `text_tool upper` ← `hello` |
| `json` | 一段完整 JSON | `json_tool get` ← `{"a":{"b":42}}` |
| `csv` | 第 1 行为表头的表格文本 | `csv_tool select` |
| `rows` | 每行一条记录 | `file_tool ls` |
| `kv` | 每行 `键 值`（仅统计类输出用） | `image_tool info` |
| `paths` | 每行一个路径 | `file_tool delete` |
| `png-or-path` | PNG 二进制，或第 1 行为图片路径 | `image_tool resize` |
| `none` | 不需要 input.desc | `crypto_tool uuid` |

---

## 3. 退出码

所有工具共用同一张表，AI 只需记住 5 个数字：

| 码 | 名称 | 含义 | AI 该如何反应 |
| --- | --- | --- | --- |
| 0 | OK | 成功 | 读 `output.desc` |
| 1 | USAGE | 用法错误（未知选项、缺必填项） | 用 `help <function>` 修正命令 |
| 2 | INPUT | 输入错误（文件缺失、内容无法解析、数量不符） | 重写 `input.desc` |
| 3 | RUNTIME | 运行时错误（算法失败、IO 失败） | 换参数或换工具 |
| 4 | UNKNOWN | 未知函数 | 用 `list` 查正确函数名 |

错误详情写到 **stderr**，格式为 `CODE(数字): 消息`，必要时附带 `hint: 建议`。

> **重要**：退出码非 0 时，`output.desc` **不会被更新**（可能是上一次的残留）。AI 必须先看退出码，再决定是否读文件。

---

## 4. 元函数（每个工具都有）

| 函数 | 作用 | 建议用法 |
| --- | --- | --- |
| `list` | 列出全部函数 | 第一次接触某工具时先跑它 |
| `help <fn>` | 打印某函数的输入输出契约与示例 | 调用前确认格式 |
| `schema [fn]` | 输出 **JSON** 机器契约 | 交给 Agent 自动消费 |
| `selftest` | 跑内置示例并校验输出 | 环境验证 / 回归 |
| `version` | 版本号 | — |

元函数名是**保留字**，优先级高于同名业务函数，保证任何情况下都能自发现。
（因此 `file_tool` 的列目录函数叫 `ls` 而不是 `list`。）

`schema` 的输出长这样（节选）：

```json
{
  "spec": "DESC/1.0",
  "tool": "basic_math_tool",
  "usage": "basic_math_tool <function> -i input.desc -o output.desc [options]",
  "exitCodes": { "OK": 0, "USAGE": 1, "INPUT": 2, "RUNTIME": 3, "UNKNOWN": 4 },
  "functions": [
    {
      "name": "add",
      "group": "算术",
      "summary": "两数相加",
      "input":  { "kind": "values", "count": 2, "example": "1 2" },
      "output": { "layout": "number", "desc": "计算结果", "example": 3 },
      "examples": [ { "input": "1 2", "expect": "3" } ]
    }
  ]
}
```

---

## 5. 给 AI 的标准调用流程

```
1. ai-tools index                      # 找到需要的工具
2. xxx_tool list                       # 找到需要的函数
3. xxx_tool help <function>            # 读 input/output 契约
4. 写 input.desc（裸数据）
5. xxx_tool <function> -i input.desc -o output.desc
6. 检查退出码；为 0 再读 output.desc
```

---

## 6. 新增一个工具的约束

1. 目录 `tools/<name>_tool/index.js`，导出 `{ name, title, category, summary, version, functions }`。
2. 工具名以 `_tool` 结尾；函数名用小写 + 下划线。
3. 每个函数必须有 `summary`、`group`、`input`、`output`、`run`；`group` 用于 `list` 分组展示。
4. 尽量提供 `examples`——它们既是文档，也是 `selftest` 的用例，还是 AI 的 few-shot 样本。
5. 函数名不得占用元函数保留名（`list` / `help` / `schema` / `selftest` / `version` / `functions`）。
6. 在 `registry.js` 与 `package.json#bin` 各加一行，并补 `bin/<name>_tool.js`。
7. 保持**零第三方依赖**，只用 Node 内置模块。

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。
