# ai-tools

[![CI](https://github.com/hupingin/ai-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/hupingin/ai-tools/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Zero dependency](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](https://github.com/hupingin/ai-tools/blob/main/package.json)

**为 AI 重新造轮子：一套统一输入输出范式的命令行工具集。**

> 仓库：<https://github.com/hupingin/ai-tools>

软件五花八门，调用方式也五花八门。这个项目把「一个功能」收敛成一种 AI 能稳定生成、稳定解析、稳定组合的形态：

```bash
xxx_tool <function> -i input.desc -o output.desc
```

全部工具都是 Node.js，**零第三方依赖**，clone 下来就能跑。

---

## 最小示例

假设有一个基本数学工具，有一个加法功能。那么：

- 输入文件 `input.desc` 就是两个数，例如 `1 2`
- 输出文件 `output.desc` 就是一个数，例如 `3`

```bash
printf '1 2' > input.desc
basic_math_tool add -i input.desc -o output.desc
cat output.desc
# => 3
```

`-i` / `-o` 有默认值，所以三行可以压成一行：

```bash
printf '1 2' > input.desc && basic_math_tool add && cat output.desc
```

---

## 为什么这样设计

| 取舍 | 说明 |
| --- | --- |
| **调用方式唯一** | 永远是 `工具 函数 -i -o`，AI 不需要为每个库学一套 CLI |
| **输入输出唯一** | 数据只走 `.desc` 文件，内容是**极简裸数据**——没有 JSON 信封、没有 key、没有类型标记 |
| **空格 ≡ 换行** | `1 2` 和 `1\n2` 完全等价，AI 不必纠结排版 |
| **契约可自发现** | 每个工具自带 `list` / `help` / `schema` / `selftest`，AI 不用查外部文档就能知道该写什么 |
| **退出码统一** | 0/1/2/3/4 五个码跨全部工具同义 |
| **示例即测试** | 每个函数内嵌的 `examples` 同时是文档、few-shot 样本和回归用例 |

裸数据的意思是：`.desc` 里怎么写，由 `tool + function` 的**契约**决定，而不是由格式决定。自描述能力交给 `schema` 元函数补上。完整规范见 [SPEC.md](./SPEC.md)。

---

## 安装

```bash
git clone https://github.com/hupingin/ai-tools.git
cd ai-tools
npm link          # 或 npm install -g .
```

也可以免安装直接用（Node >= 18）：

```bash
node bin/basic_math_tool.js add -i input.desc -o output.desc
```

或者用聚合入口：

```bash
node bin/ai-tools.js basic_math add -i input.desc -o output.desc   # 工具名可省略 _tool 后缀
node bin/ai-tools.js index --json                                  # 全量机器可读清单
```

---

## 工具一览

共 **12 个工具、276 个函数**（完整清单见自动生成的 [INDEX.md](./INDEX.md)，机器可读版见 [MANIFEST.json](./MANIFEST.json)）。

| 工具 | 行业分类 | 函数数 | 说明 |
| --- | --- | --- | --- |
| [`basic_math_tool`](./tools/basic_math_tool) | 通用 / 数学 | 40 | 加减乘除、取整、指数对数、三角、数论、进制转换 |
| [`statistics_tool`](./tools/statistics_tool) | 通用 / 数据 | 27 | 描述统计、离散程度、数据变换、双序列相关与回归 |
| [`text_tool`](./tools/text_tool) | 通用 / 文本 | 44 | 统计、大小写、命名风格、清洗、查找替换、行操作、相似度 |
| [`json_tool`](./tools/json_tool) | 通用 / 数据 | 19 | 格式化、路径读写、增删改、数组筛选排序、深度合并与差异比较 |
| [`csv_tool`](./tools/csv_tool) | 通用 / 数据 | 16 | CSV 解析与生成、列选择筛选排序、去重、聚合统计、JSON 互转 |
| [`datetime_tool`](./tools/datetime_tool) | 通用 / 时间 | 20 | ISO8601 解析与格式化、时间加减、差值、工作日、时间戳、周期边界 |
| [`file_tool`](./tools/file_tool) | 通用 / 系统 | 19 | 文件读写、复制移动删除、属性查询、目录列举查找、哈希与全文搜索 |
| [`crypto_tool`](./tools/crypto_tool) | 安全 / 编码 | 24 | 哈希与 HMAC、Base64/Hex/URL 编解码、UUID 与随机数、AES 加解密、口令派生、古典密码 |
| [`unit_tool`](./tools/unit_tool) | 通用 / 度量 | 6 | 长度、质量、温度、时间、面积、体积、速度、数据量、压强、能量、功率、角度换算 |
| [`color_tool`](./tools/color_tool) | 设计 / 视觉 | 22 | HEX/RGB/HSL/HSV/CMYK 互转、明暗与饱和度调整、混色渐变、WCAG 对比度 |
| [`image_tool`](./tools/image_tool) | 设计 / 视觉 | 21 | 零依赖 PNG 编解码：信息统计、缩放裁剪旋转、色彩调整、模糊锐化边缘、图像比较与字符画 |
| [`finance_tool`](./tools/finance_tool) | 金融 / 财务 | 18 | 单利复利、现值终值、NPV/IRR、等额本息摊销、ROI/CAGR、盈亏平衡与折旧 |

> `finance_tool` 里所有利率统一用**小数**（`0.05` = 5%）。

---

## 用法

### 1. 找一个函数

```bash
basic_math_tool list            # 列出全部函数
basic_math_tool list --json     # JSON 版，方便程序消费
```

### 2. 读它的输入输出契约

```bash
basic_math_tool help add
basic_math_tool schema add      # 纯 JSON，给 Agent 用
```

`help add` 会告诉你：`input.desc` 写两个数字，`output.desc` 得到一个数字，并给出可直接抄的示例。

### 3. 调用

```bash
printf '10 4' > input.desc
basic_math_tool div -i input.desc -o output.desc
cat output.desc    # => 2.5
```

### 4. 组合（管道友好）

`-i -` 读 stdin，`-o -` 写 stdout：

```bash
printf '3.14159' | basic_math_tool round -i - -o - --digits 2
# => 3.14

printf '#ff0000' | color_tool to_hsl -i - -o -
printf '#ff0000' | color_tool darken -i - -o - --amount 0.2
```

---

## 退出码

跨全部工具同义，AI 只需记住 5 个数字：

| 码 | 名称 | 含义 | AI 该如何反应 |
| --- | --- | --- | --- |
| 0 | OK | 成功 | 读 `output.desc` |
| 1 | USAGE | 用法错误（未知选项、缺必填项） | 用 `help <function>` 修正命令 |
| 2 | INPUT | 输入错误（文件缺失、内容无法解析、数量不符） | 重写 `input.desc` |
| 3 | RUNTIME | 运行时错误（算法失败、IO 失败） | 换参数或换工具 |
| 4 | UNKNOWN | 未知函数 | 用 `list` 查正确函数名 |

错误详情走 stderr，格式 `CODE(数字): 消息`，必要时附 `hint: 建议`。

> **重要**：退出码非 0 时 `output.desc` 不会被更新（可能是上一次的残留）。**先看退出码，再读文件。**

---

## 给 AI / Agent 的标准调用流程

```text
1. ai-tools index                    # 找到需要的工具
2. xxx_tool list                     # 找到需要的函数
3. xxx_tool help <function>          # 读 input/output 契约
4. 写 input.desc（裸数据）
5. xxx_tool <function> -i input.desc -o output.desc
6. 检查退出码；为 0 再读 output.desc
```

如果你要的是机器可读的全量契约，直接读 [MANIFEST.json](./MANIFEST.json)，或：

```bash
node bin/ai-tools.js index --json > MANIFEST.json
```

---

## 目录结构

```text
ai-tools/
├── bin/                     # 13 个可执行入口（12 工具 + ai-tools 聚合器）
├── lib/
│   ├── cli.js               # 统一 CLI 引擎：参数解析、元函数、退出码、原子写入
│   ├── desc.js              # DESC/1.0 读取器（三层视图）
│   ├── errors.js            # 统一错误与退出码
│   ├── num.js               # 数值工具（格式化、分位数、牛顿法求根…）
│   ├── table.js             # 零依赖对齐表格（含 CJK 宽度）
│   └── png.js               # 零依赖 PNG 编解码（filter 0-4 / colorType 0,2,3,4,6）
├── tools/<name>_tool/       # 12 个工具，每个导出 { name, functions }
├── scripts/
│   ├── selftest-all.js      # 跑全部工具的内置示例
│   ├── gen-index.js         # 生成 INDEX.md + MANIFEST.json
│   └── smoke.js             # 端到端冒烟（14 项）
├── test/                    # node:test 单元测试
├── SPEC.md                  # DESC/1.0 规范
├── INDEX.md                 # 自动生成的人读索引
└── MANIFEST.json            # 自动生成的机器契约
```

---

## 开发

```bash
npm test           # node --test，35 个单元测试
npm run selftest   # 跑全部工具的内置示例（276 个函数、数百条用例）
npm run smoke      # 端到端冒烟，14 项
npm run index      # 重新生成 INDEX.md 与 MANIFEST.json
```

新增工具/函数请看 [CONTRIBUTING.md](./CONTRIBUTING.md) 与 [SPEC.md](./SPEC.md)。

---

## 设计约束

1. **零第三方依赖**——只用 Node 内置模块。
2. **工具名一律 `_tool` 结尾**，按行业分门别类。
3. **函数名小写 + 下划线**，不得占用元函数保留名（`list` / `functions` / `help` / `schema` / `selftest` / `version`）。
4. **每个函数都要有 `examples`**——它们同时是文档、few-shot 样本和 `selftest` 用例。
5. **退出码非 0 不写 `output.desc`**。

---

## License

[MIT](./LICENSE)
