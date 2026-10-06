# AI Tools 索引

> 本文件由 `npm run index` 自动生成，请勿手改。

共 **12** 个工具、**276** 个函数。

| 工具 | 行业分类 | 函数数 | 说明 |
| --- | --- | --- | --- |
| `basic_math_tool` | 通用 / 数学 | 40 | 加减乘除、取整、指数对数、三角、数论、进制转换 |
| `statistics_tool` | 通用 / 数据 | 27 | 描述统计、离散程度、数据变换、双序列相关与回归 |
| `text_tool` | 通用 / 文本 | 44 | 统计、大小写、命名风格、清洗、查找替换、行操作、相似度 |
| `json_tool` | 通用 / 数据 | 19 | 格式化、路径读写、增删改、数组筛选排序、深度合并与差异比较 |
| `csv_tool` | 通用 / 数据 | 16 | CSV 解析与生成、列选择筛选排序、去重、聚合统计、JSON 互转 |
| `datetime_tool` | 通用 / 时间 | 20 | ISO8601 解析与格式化、时间加减、差值、工作日、时间戳、周期边界 |
| `file_tool` | 通用 / 系统 | 19 | 文件读写、复制移动删除、属性查询、目录列举查找、哈希与全文搜索 |
| `crypto_tool` | 安全 / 编码 | 24 | 哈希与 HMAC、Base64/Hex/URL 编解码、UUID 与随机数、AES 加解密、口令派生、古典密码 |
| `unit_tool` | 通用 / 度量 | 6 | 长度、质量、温度、时间、面积、体积、速度、数据量、压强、能量、功率、角度的换算 |
| `color_tool` | 设计 / 视觉 | 22 | HEX/RGB/HSL/HSV/CMYK 互转、明暗与饱和度调整、混色渐变、WCAG 对比度 |
| `image_tool` | 设计 / 视觉 | 21 | 零依赖 PNG 编解码：信息统计、缩放裁剪旋转、色彩调整、模糊锐化边缘、图像比较与字符画 |
| `finance_tool` | 金融 / 财务 | 18 | 单利复利、现值终值、NPV/IRR、等额本息摊销、ROI/CAGR、盈亏平衡与折旧（利率统一用小数，0.05=5%） |

## basic_math_tool

基础数学工具 — 加减乘除、取整、指数对数、三角、数论、进制转换

```
basic_math_tool <function> -i input.desc -o output.desc
```

| 分组 | 函数 | 说明 | input.desc | output.desc |
| --- | --- | --- | --- | --- |
| 算术 | `add` | 两数相加 | `1 2` | `3` |
| 算术 | `sub` | 两数相减 (a - b) | `5 3` | `2` |
| 算术 | `mul` | 两数相乘 | `6 7` | `42` |
| 算术 | `div` | 两数相除 (a / b) | `10 4` | `2.5` |
| 算术 | `mod` | 取余 (a % b) | `17 5` | `2` |
| 算术 | `pow` | 幂 (a ^ b) | `2 10` | `1024` |
| 算术 | `neg` | 取负 | `8` | `-8` |
| 算术 | `abs` | 绝对值 | `-3.5` | `3.5` |
| 算术 | `sum` | 求和（任意个数） | `1 2 3 4` | `10` |
| 算术 | `product` | 连乘（任意个数） | `2 3 4` | `24` |
| 取整 | `floor` | 向下取整 | `3.7` | `3` |
| 取整 | `ceil` | 向上取整 | `3.2` | `4` |
| 取整 | `trunc` | 截断小数 | `-3.7` | `-3` |
| 取整 | `round` | 四舍五入，--digits 指定小数位 | `3.14159` | `3` |
| 比较 | `min` | 最小值（任意个数） | `4 1 9 2` | `1` |
| 比较 | `max` | 最大值（任意个数） | `4 1 9 2` | `9` |
| 比较 | `clamp` | 区间截断 (x, lo, hi) | `15 0 10` | `10` |
| 指数对数 | `sqrt` | 平方根 | `16` | `4` |
| 指数对数 | `cbrt` | 立方根 | `27` | `3` |
| 指数对数 | `exp` | e 的 x 次方 | `1` | `2.718281828459` |
| 指数对数 | `ln` | 自然对数 | `1` | `0` |
| 指数对数 | `log10` | 常用对数 | `100` | `2` |
| 指数对数 | `log` | 以 b 为底的对数 (x, b) | `8 2` | `3` |
| 三角 | `sin` | 正弦，--deg 使用角度 | `0` | `0` |
| 三角 | `cos` | 余弦，--deg 使用角度 | `0` | `1` |
| 三角 | `tan` | 正切，--deg 使用角度 | `0` | `0` |
| 三角 | `asin` | 反正弦，--deg 输出角度 | `0` | `0` |
| 三角 | `acos` | 反余弦，--deg 输出角度 | `1` | `0` |
| 三角 | `atan` | 反正切，--deg 输出角度 | `0` | `0` |
| 三角 | `atan2` | 四象限反正切 (y, x)，--deg 输出角度 | `1 1` | `0.785398163397` |
| 三角 | `hypot` | 欧氏距离 sqrt(x^2+y^2)（任意个数） | `3 4` | `5` |
| 数论 | `gcd` | 最大公约数（任意个数） | `12 18` | `6` |
| 数论 | `lcm` | 最小公倍数（任意个数） | `4 6` | `12` |
| 数论 | `factorial` | 阶乘 n! | `5` | `120` |
| 数论 | `fibonacci` | 第 n 个斐波那契数 (F(0)=0) | `10` | `55` |
| 数论 | `is_prime` | 素数判定，输出 true/false | `97` | `true` |
| 数论 | `prime_factors` | 质因数分解，输出空白分隔的质因数 | `360` | `2 2 2 3 3 5` |
| 数论 | `next_prime` | 大于等于 n 的最小素数 | `100` | `101` |
| 进制 | `base` | 进制转换 (数值, 原进制, 目标进制)，2~36 | `255 10 16` | `FF` |
| 常量 | `constant` | 取数学常量：pi / e / phi / sqrt2 / ln2 / ln10 | `pi` | `3.14159265359` |

## statistics_tool

统计工具 — 描述统计、离散程度、数据变换、双序列相关与回归

```
statistics_tool <function> -i input.desc -o output.desc
```

| 分组 | 函数 | 说明 | input.desc | output.desc |
| --- | --- | --- | --- | --- |
| 描述统计 | `count` | 样本个数 | `1 2 3` | `3` |
| 描述统计 | `sum` | 求和 | `1 2 3 4` | `10` |
| 描述统计 | `mean` | 算术平均 | `1 2 3 4 5` | `3` |
| 描述统计 | `median` | 中位数 | `3 1 2` | `2` |
| 描述统计 | `mode` | 众数（多个则全部输出） | `1 2 2 3 3 3` | `3` |
| 描述统计 | `geometric_mean` | 几何平均 | `2 8` | `4` |
| 描述统计 | `harmonic_mean` | 调和平均 | `1 2 4` | `1.71428571429` |
| 离散程度 | `range` | 极差 (max - min) | `1 5 9` | `8` |
| 离散程度 | `variance` | 方差，--ddof 1 为样本方差 | `2 4 4 4 5 5 7 9` | `4` |
| 离散程度 | `stdev` | 标准差，--ddof 1 为样本标准差 | `2 4 4 4 5 5 7 9` | `2` |
| 离散程度 | `cv` | 变异系数 stdev/mean | `2 4 6` | `0.408248290464` |
| 离散程度 | `mad` | 平均绝对偏差 | `1 2 3 4` | `1` |
| 离散程度 | `iqr` | 四分位距 Q3 - Q1 | `1 2 3 4 5 6 7 8` | `3.5` |
| 离散程度 | `quantile` | 分位数，--q 指定概率 (0~1) | `1 2 3 4 5` | `3` |
| 离散程度 | `percentile` | 百分位数，--p 指定百分位 (0~100) | `1 2 3 4 5` | `4` |
| 离散程度 | `outliers` | IQR 法离群点（1.5×IQR 之外） | `1 2 3 4 100` | `100` |
| 变换 | `zscore` | 标准化 z = (x - mean) / stdev | `1 2 3` | `-1.22474487139 0 1.22474487139` |
| 变换 | `normalize` | Min-Max 归一化到 [0,1] | `0 5 10` | `0 0.5 1` |
| 变换 | `cumsum` | 累计和 | `1 2 3` | `1 3 6` |
| 变换 | `diff` | 一阶差分（后项减前项） | `1 3 6 10` | `2 3 4` |
| 变换 | `moving_average` | 滑动平均，--window 窗口大小 | `1 2 3 4 5` | `2 3 4` |
| 变换 | `sort` | 排序，--desc 降序 | `3 1 2` | `1 2 3` |
| 变换 | `histogram` | 直方图，--bins 指定桶数，输出每行 "下界 上界 计数" | `1 2 3 4 5` | `1 1.4 1 ⏎ 1.4 1.8 0 ⏎ 1.8 2.2 1 ⏎ 2.2 2.6 0 ⏎ 2.6 3 0 ⏎ 3 3.4 1 ⏎ 3.4 3.8 0 ⏎ 3.8 4.2 1 ⏎ 4.2 4.6 0 ⏎ 4.6 5 1` |
| 双序列 | `covariance` | 协方差 | `1 2 3 ⏎ 2 4 6` | `1.33333333333` |
| 双序列 | `correlation` | 皮尔逊相关系数 | `1 2 3 ⏎ 2 4 6` | `1` |
| 双序列 | `spearman` | 斯皮尔曼秩相关系数 | `1 2 3 ⏎ 2 4 6` | `1` |
| 双序列 | `linear_regression` | 一元线性回归 y = a + b·x，输出 "a b r2" | `1 2 3 ⏎ 2 4 6` | `0 2 1` |

## text_tool

文本处理工具 — 统计、大小写、命名风格、清洗、查找替换、行操作、相似度

```
text_tool <function> -i input.desc -o output.desc
```

| 分组 | 函数 | 说明 | input.desc | output.desc |
| --- | --- | --- | --- | --- |
| 统计 | `stats` | 输出字符/词/行/字节统计 | `hello world` | `chars 11 ⏎ chars_no_spaces 10 ⏎ words 2 ⏎ lines 1 ⏎ bytes 11` |
| 统计 | `count_chars` | 字符数，--no-spaces 忽略空白 | `hello world` | `11` |
| 统计 | `count_words` | 词数（按空白分词；中文请用 count_chars） | `hello brave world` | `3` |
| 统计 | `count_lines` | 行数 | `a ⏎ b ⏎ c` | `3` |
| 统计 | `word_freq` | 词频 Top N，输出每行 "词 次数" | `a b a c b a` | `a 3 ⏎ b 2 ⏎ c 1` |
| 统计 | `char_freq` | 字符频次 Top N，输出每行 "字符 次数" | `aab` | `a 2 ⏎ b 1` |
| 大小写 | `upper` | 转大写 | `hello` | `HELLO` |
| 大小写 | `lower` | 转小写 | `HELLO` | `hello` |
| 大小写 | `title` | 每个词首字母大写 | `hello world` | `Hello World` |
| 大小写 | `capitalize` | 首字母大写，其余小写 | `hELLO` | `Hello` |
| 大小写 | `swapcase` | 大小写互换 | `Hello` | `hELLO` |
| 命名风格 | `snake_case` | 转为 snake_case | `HelloWorld` | `hello_world` |
| 命名风格 | `kebab_case` | 转为 kebab-case | `HelloWorld` | `hello-world` |
| 命名风格 | `camel_case` | 转为 camelCase | `hello world` | `helloWorld` |
| 命名风格 | `pascal_case` | 转为 PascalCase | `hello world` | `HelloWorld` |
| 命名风格 | `slugify` | 转为 URL slug | `Hello, World!` | `hello-world` |
| 清洗 | `trim` | 去除首尾空白 | `  hi  ` | `hi` |
| 清洗 | `trim_start` | 去除开头空白 | `  hi  ` | `hi  ` |
| 清洗 | `trim_end` | 去除结尾空白 | `  hi  ` | `  hi` |
| 清洗 | `strip_empty` | 删除空行 | `a ⏎  ⏎ b` | `a ⏎ b` |
| 清洗 | `dedent` | 去除每行公共缩进 | `    a ⏎     b` | `a ⏎ b` |
| 清洗 | `indent` | 每行加前缀，--n 空格数或 --prefix 自定义 | `a ⏎ b` | `  a ⏎   b` |
| 清洗 | `squeeze_blank` | 连续空行压缩为一行 | `a ⏎  ⏎  ⏎ b` | `a ⏎  ⏎ b` |
| 变换 | `reverse` | 反转全文字符 | `abc` | `cba` |
| 变换 | `reverse_lines` | 反转行顺序 | `a ⏎ b ⏎ c` | `c ⏎ b ⏎ a` |
| 变换 | `repeat` | 重复 N 次，--n 次数，--sep 分隔符 | `ab` | `abab` |
| 变换 | `pad_start` | 左侧补齐到 --n 长度 | `7` | `         7` |
| 变换 | `pad_end` | 右侧补齐到 --n 长度 | `7` | `7         ` |
| 变换 | `truncate` | 截断到 --n 字符并加后缀 | `abcdefghij` | `abcde...` |
| 变换 | `wrap` | 按 --width 折行 | `aaa bbb ccc` | `aaa bbb ⏎ ccc` |
| 查找替换 | `replace` | 替换文本，--from/--to，--regex 启用正则 | `a-b-c` | `a b c` |
| 查找替换 | `contains` | 是否包含 --needle，输出 true/false | `hello world` | `true` |
| 查找替换 | `starts_with` | 是否以 --needle 开头 | `hello` | `true` |
| 查找替换 | `ends_with` | 是否以 --needle 结尾 | `hello` | `true` |
| 查找替换 | `extract` | 按 --regex 抽取，每行一个匹配（--group 取指定捕获组） | `a1 b22 c333` | `1 ⏎ 22 ⏎ 333` |
| 查找替换 | `substring` | 截取子串，位置参数 [start] [end] | `hello world` | `hello` |
| 行操作 | `sort_lines` | 行排序，--desc 降序，--numeric 按数值 | `10 ⏎ 9 ⏎ b` | `9 ⏎ 10 ⏎ b` |
| 行操作 | `uniq` | 去重，--count 输出每行出现次数 | `a ⏎ b ⏎ a` | `a ⏎ b` |
| 行操作 | `join` | 用 --sep 把多行连成一行 | `a ⏎ b ⏎ c` | `a,b,c` |
| 行操作 | `split` | 用 --sep 把文本切成多行 | `a,b,c` | `a ⏎ b ⏎ c` |
| 行操作 | `head` | 取前 --n 行 | `a ⏎ b ⏎ c` | `a ⏎ b` |
| 行操作 | `tail` | 取后 --n 行 | `a ⏎ b ⏎ c` | `b ⏎ c` |
| 相似度 | `levenshtein` | 编辑距离（input 两行，每行一个字符串） | `kitten ⏎ sitting` | `3` |
| 相似度 | `similarity` | 归一化相似度 0~1（input 两行，每行一个字符串） | `kitten ⏎ sitting` | `0.571428571429` |

## json_tool

JSON 处理工具 — 格式化、路径读写、增删改、数组筛选排序、深度合并与差异比较

```
json_tool <function> -i input.desc -o output.desc
```

| 分组 | 函数 | 说明 | input.desc | output.desc |
| --- | --- | --- | --- | --- |
| 格式化 | `format` | 美化输出，--indent 缩进空格数 | `{"a":1,"b":[2,3]}` | `{ ⏎   "a": 1, ⏎   "b": [ ⏎     2, ⏎     3 ⏎   ] ⏎ }` |
| 格式化 | `minify` | 压缩为单行 | `{ "a": 1, "b": [2] }` | `{"a":1,"b":[2]}` |
| 格式化 | `validate` | 校验 JSON 合法性，输出 "ok <类型>" | `[1,2]` | `ok array` |
| 读取 | `get` | 按 --path 取值，输出该值的 JSON | `{"a":{"b":42}}` | `42` |
| 读取 | `keys` | 取键名，--path 指定子树，--deep 递归全部路径 | `{"a":1,"b":2}` | `a ⏎ b` |
| 读取 | `values` | 取所有值（JSON 数组） | `{"a":1,"b":2}` | `[ ⏎   1, ⏎   2 ⏎ ]` |
| 读取 | `size` | 统计节点数与最大深度 | `{"a":[1,2]}` | `nodes 4 ⏎ depth 3` |
| 读取 | `type` | 取 --path 处的类型 | `{"a":[1]}` | `array` |
| 修改 | `set` | 设置 --path 处的值为 --value（自动识别 JSON 字面量） | `{"a":1}` | `{ ⏎   "a": 1, ⏎   "b": "x" ⏎ }` |
| 修改 | `delete` | 删除 --path 处的键/元素 | `{"a":1,"b":2}` | `{ ⏎   "a": 1 ⏎ }` |
| 修改 | `merge` | 深度合并：input 为 JSON 数组，后者覆盖前者 | `[{"a":1,"b":{"x":1}},{"b":{"y":2}}]` | `{ ⏎   "a": 1, ⏎   "b": { ⏎     "x": 1, ⏎     "y": 2 ⏎   } ⏎ }` |
| 修改 | `flatten` | 扁平化为一层，--sep 键分隔符 | `{"a":{"b":1}}` | `{ ⏎   "a.b": 1 ⏎ }` |
| 修改 | `unflatten` | 把扁平键还原为嵌套结构，--sep 键分隔符 | `{"a.b":1}` | `{ ⏎   "a": { ⏎     "b": 1 ⏎   } ⏎ }` |
| 数组 | `select` | 从对象数组中挑选字段，--keys 逗号分隔 | `[{"a":1,"b":2},{"a":3,"b":4}]` | `[ ⏎   { ⏎     "a": 1 ⏎   }, ⏎   { ⏎     "a": 3 ⏎   } ⏎ ]` |
| 数组 | `sort` | 按 --by 字段排序，--desc 降序，--numeric 数值比较 | `[{"n":3},{"n":1},{"n":2}]` | `[ ⏎   { ⏎     "n": 1 ⏎   }, ⏎   { ⏎     "n": 2 ⏎   }, ⏎   { ⏎     "n": 3 ⏎   } ⏎ ]` |
| 数组 | `filter` | 筛选数组元素：--path 取值后与 --value 比较，--op 比较符 | `[{"n":1},{"n":5},{"n":9}]` | `[ ⏎   { ⏎     "n": 5 ⏎   }, ⏎   { ⏎     "n": 9 ⏎   } ⏎ ]` |
| 数组 | `pluck` | 抽取数组中每个元素的 --path 值，组成新数组 | `[{"n":1},{"n":2}]` | `[ ⏎   1, ⏎   2 ⏎ ]` |
| 数组 | `reverse` | 反转数组 | `[1,2,3]` | `[ ⏎   3, ⏎   2, ⏎   1 ⏎ ]` |
| 数组 | `diff` | 比较两个 JSON：input 为长度 2 的数组，输出差异行 | `[{"a":1,"b":2},{"a":1,"b":3,"c":4}]` | `~ b: 2 -> 3 ⏎ + c: 4` |

## csv_tool

CSV 表格工具 — CSV 解析与生成、列选择筛选排序、去重、聚合统计、JSON 互转

```
csv_tool <function> -i input.desc -o output.desc
```

| 分组 | 函数 | 说明 | input.desc | output.desc |
| --- | --- | --- | --- | --- |
| 概览 | `info` | 输出行列数与列名 | `name,age ⏎ Tom,18 ⏎ Ann,20` | `rows 2 ⏎ cols 2 ⏎ columns name,age` |
| 概览 | `count` | 数据行数（不含表头） | `a ⏎ 1 ⏎ 2 ⏎ 3` | `3` |
| 概览 | `pretty` | 对齐成等宽文本表格 | `name,age ⏎ Tom,18` | `NAME  AGE ⏎ ----  --- ⏎ Tom   18` |
| 转换 | `to_json` | CSV 转 JSON 数组（每行为一个对象） | `name,age ⏎ Tom,18` | `[ ⏎   { ⏎     "name": "Tom", ⏎     "age": "18" ⏎   } ⏎ ]` |
| 转换 | `from_json` | JSON 对象数组转 CSV | `[{"name":"Tom","age":18}]` | `name,age ⏎ Tom,18` |
| 转换 | `transpose` | 行列转置 | `a,b ⏎ 1,2` | `a,1 ⏎ b,2` |
| 选择 | `select` | 挑选列，--cols 逗号分隔 | `a,b,c ⏎ 1,2,3` | `a,c ⏎ 1,3` |
| 选择 | `head` | 取前 --n 行 | `a ⏎ 1 ⏎ 2 ⏎ 3` | `a ⏎ 1 ⏎ 2` |
| 选择 | `tail` | 取后 --n 行 | `a ⏎ 1 ⏎ 2 ⏎ 3` | `a ⏎ 2 ⏎ 3` |
| 选择 | `filter` | 按列筛选：--col --op --value | `n ⏎ 1 ⏎ 5 ⏎ 9` | `n ⏎ 5 ⏎ 9` |
| 选择 | `sort` | 按列排序，--desc 降序，--numeric 数值比较 | `n ⏎ 3 ⏎ 1 ⏎ 2` | `n ⏎ 1 ⏎ 2 ⏎ 3` |
| 选择 | `dedupe` | 按整行去重，--col 指定按某列去重 | `a ⏎ 1 ⏎ 1 ⏎ 2` | `a ⏎ 1 ⏎ 2` |
| 聚合 | `aggregate` | 对列做聚合：--col --fn (sum|mean|min|max|count|median|stdev) | `n ⏎ 1 ⏎ 2 ⏎ 3` | `6` |
| 聚合 | `stats` | 数值列描述统计 | `n ⏎ 1 ⏎ 2 ⏎ 3` | `count 3 ⏎ sum 6 ⏎ mean 2 ⏎ min 1 ⏎ max 3 ⏎ median 2 ⏎ stdev 0.816496580928` |
| 聚合 | `group_by` | 分组聚合：--by 分组列，--agg "列:函数" 可多次用逗号分隔 | `g,n ⏎ a,1 ⏎ a,2 ⏎ b,5` | `g,n_sum ⏎ a,3 ⏎ b,5` |
| 聚合 | `unique` | 某列的去重值，每行一个 | `g ⏎ a ⏎ b ⏎ a` | `a ⏎ b` |

## datetime_tool

日期时间工具 — ISO8601 解析与格式化、时间加减、差值、工作日、时间戳、周期边界

```
datetime_tool <function> -i input.desc -o output.desc
```

| 分组 | 函数 | 说明 | input.desc | output.desc |
| --- | --- | --- | --- | --- |
| 当前时间 | `now` | 输出当前时间，--offset 指定时区，--format 指定格式 | — | — |
| 当前时间 | `today` | 输出今天日期 %Y-%m-%d | — | — |
| 格式化 | `format` | 按 --format 格式化输入时间 | `2026-01-02T03:04:05Z` | `2026/01/02 03:04` |
| 格式化 | `to_iso` | 归一化为 ISO8601（带时区偏移） | `2026/01/02 03:04` | `2026-01-02T03:04:00+00:00` |
| 运算 | `add` | 时间加减：输入 "时间 数量 单位"，如 "2026-01-01 3 day" | `2026-01-01 3 day` | `2026-01-04 00:00:00` |
| 运算 | `diff` | 两个时间之差（后减前），--unit 指定单位 | `2026-01-01 ⏎ 2026-01-11` | `10` |
| 运算 | `business_days` | 两个日期之间的工作日天数（含首、含尾，跳过周末） | `2026-01-01 ⏎ 2026-01-11` | `7` |
| 运算 | `add_business_days` | 从起始日期起算 N 个工作日后的日期（跳过周末） | `2026-01-01 5` | `2026-01-08 00:00:00` |
| 属性 | `weekday` | 星期几，输出 "ISO序号 英文名"（1=周一） | `2026-01-01` | `4 Thursday` |
| 属性 | `quarter` | 所属季度 1~4 | `2026-05-01` | `2` |
| 属性 | `week_of_year` | ISO 周序号 | `2026-01-01` | `1` |
| 属性 | `day_of_year` | 一年中的第几天 | `2026-01-01` | `1` |
| 属性 | `is_leap` | 是否闰年，输出 true/false | `2024` | `true` |
| 属性 | `days_in_month` | 该月天数 | `2024-02` | `29` |
| 属性 | `age` | 距指定日期的周岁年数（第二行为"截至日期"，可省略） | `2000-01-01 ⏎ 2026-01-01` | `26` |
| 时间戳 | `timestamp` | 转 Unix 时间戳，--ms 输出毫秒 | `1970-01-01T00:00:00Z` | `0` |
| 时间戳 | `from_timestamp` | Unix 时间戳转 ISO，自动识别秒/毫秒 | `0` | `1970-01-01 00:00:00` |
| 边界 | `start_of` | 取所处周期的起点，--unit day|week|month|year | `2026-05-17 10:20:30` | `2026-05-17 00:00:00` |
| 边界 | `end_of` | 取所处周期的终点（含最后一秒），--unit day|week|month|year | `2026-05-17 10:20:30` | `2026-05-17 23:59:59` |
| 边界 | `convert_tz` | 把时间换算到 --offset 指定的时区显示 | `2026-01-01T00:00:00Z` | `2026-01-01T08:00:00+08:00` |

## file_tool

文件系统工具 — 文件读写、复制移动删除、属性查询、目录列举查找、哈希与全文搜索

```
file_tool <function> -i input.desc -o output.desc
```

| 分组 | 函数 | 说明 | input.desc | output.desc |
| --- | --- | --- | --- | --- |
| 读写 | `read` | 读取文本文件内容 | — | — |
| 读写 | `write` | 写入文件：第 1 行为路径，其余为内容 | — | — |
| 读写 | `append` | 追加内容：第 1 行为路径，其余为内容 | — | — |
| 读写 | `replace_in_place` | 就地替换：第 1 行路径，第 2 行查找，第 3 行替换 | — | — |
| 文件操作 | `copy` | 复制：第 1 行源，第 2 行目标 | — | — |
| 文件操作 | `move` | 移动/重命名：第 1 行源，第 2 行目标 | — | — |
| 文件操作 | `delete` | 删除文件或目录，每行一个路径 | — | — |
| 文件操作 | `mkdir` | 创建目录，每行一个路径 | — | — |
| 文件操作 | `touch` | 创建空文件或更新时间戳，每行一个路径 | — | — |
| 查询 | `exists` | 路径是否存在，输出 true/false | — | — |
| 查询 | `stat` | 输出文件属性 | — | — |
| 查询 | `size` | 字节大小 | — | — |
| 查询 | `lines` | 文本行数 | — | — |
| 查询 | `hash` | 文件哈希，--algo 指定算法 | — | — |
| 目录 | `ls` | 列出目录条目，--all 含隐藏，--long 带大小 | — | — |
| 目录 | `find` | 在目录中查找，第 1 行目录，第 2 行关键字（可为 --ext 后缀） | — | — |
| 目录 | `tree` | 输出目录树，--depth 限制层级 | — | — |
| 目录 | `dirsize` | 统计目录下文件数、目录数与总字节 | — | — |
| 目录 | `grep` | 在文件中搜索，第 1 行文件路径，第 2 行关键字 | — | — |

## crypto_tool

编码加密工具 — 哈希与 HMAC、Base64/Hex/URL 编解码、UUID 与随机数、AES 加解密、口令派生、古典密码

```
crypto_tool <function> -i input.desc -o output.desc
```

| 分组 | 函数 | 说明 | input.desc | output.desc |
| --- | --- | --- | --- | --- |
| 哈希 | `md5` | md5 摘要（十六进制） | `abc` | `900150983cd24fb0d6963f7d28e17f72` |
| 哈希 | `sha1` | sha1 摘要（十六进制） | `abc` | `a9993e364706816aba3e25717850c26c9cd0d89d` |
| 哈希 | `sha256` | sha256 摘要（十六进制） | `abc` | `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` |
| 哈希 | `sha512` | sha512 摘要（十六进制） | `abc` | `ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f` |
| 哈希 | `crc32` | CRC32 校验值（十六进制 8 位） | `abc` | `352441c2` |
| 哈希 | `hmac` | HMAC 签名：--key 密钥，--algo 算法 | `abc` | `9946dad4e00e913fc8be8e5d3f7e110a4a9e832f83fb09c345285d78638d8a0e` |
| 编码 | `base64_encode` | Base64 编码 | `abc` | `YWJj` |
| 编码 | `base64_decode` | Base64 解码 | `YWJj` | `abc` |
| 编码 | `base64url_encode` | Base64URL 编码（URL 安全） | `???>>>` | `Pz8_Pj4-` |
| 编码 | `base64url_decode` | Base64URL 解码 | `Pz8_Pj4-` | `???>>>` |
| 编码 | `hex_encode` | 十六进制编码 | `abc` | `616263` |
| 编码 | `hex_decode` | 十六进制解码 | `616263` | `abc` |
| 编码 | `url_encode` | URL 百分号编码 | `a b&c` | `a%20b%26c` |
| 编码 | `url_decode` | URL 百分号解码 | `a%20b%26c` | `a b&c` |
| 随机 | `uuid` | 生成 UUID v4（无需输入） | — | — |
| 随机 | `random_hex` | 生成随机十六进制串，--n 字节数 | — | — |
| 随机 | `random_string` | 生成随机字符串，--n 长度，--charset 字符集 | — | — |
| 对称加密 | `aes_encrypt` | AES 加密：--key 口令，--mode gcm|cbc，输出 Base64（含 IV） | `hello` | — |
| 对称加密 | `aes_decrypt` | AES 解密：--key 口令，--mode gcm|cbc | — | — |
| 口令派生 | `pbkdf2` | PBKDF2 派生密钥，--salt --iterations --keylen --digest | — | — |
| 口令派生 | `scrypt` | scrypt 派生密钥，--salt --keylen | — | — |
| 古典密码 | `caesar` | 凯撒移位，--shift 位移量（可为负） | `abc` | `nop` |
| 古典密码 | `rot13` | ROT13（凯撒 13 位移） | `abc` | `nop` |
| 古典密码 | `xor` | 按 --key 循环异或，输出十六进制 | `abc` | `202322` |

## unit_tool

单位换算工具 — 长度、质量、温度、时间、面积、体积、速度、数据量、压强、能量、功率、角度的换算

```
unit_tool <function> -i input.desc -o output.desc
```

| 分组 | 函数 | 说明 | input.desc | output.desc |
| --- | --- | --- | --- | --- |
| 换算 | `convert` | 单位换算：输入 "数值 原单位 目标单位"，如 "100 km m" | `100 km m` | `100000` |
| 换算 | `convert_batch` | 批量换算：第 1 行 "原单位 目标单位"，其余每行一个数值 | `km m ⏎ 1 ⏎ 2` | `1000 ⏎ 2000` |
| 查询 | `categories` | 列出全部单位类别 | — | — |
| 查询 | `list_units` | 列出单位，--category 限定类别 | — | — |
| 查询 | `to_base` | 换算为该类别的基准单位 | `5 km` | `5000` |
| 查询 | `explain` | 说明一次换算的因子与类别，便于核对 | `km m` | `category length ⏎ from km ⏎ to m ⏎ factor 1000` |

## color_tool

颜色工具 — HEX/RGB/HSL/HSV/CMYK 互转、明暗与饱和度调整、混色渐变、WCAG 对比度

```
color_tool <function> -i input.desc -o output.desc
```

| 分组 | 函数 | 说明 | input.desc | output.desc |
| --- | --- | --- | --- | --- |
| 转换 | `parse` | 把任意颜色写法归一化为 #rrggbb | `#f00` | `#ff0000` |
| 转换 | `hex_to_rgb` | 十六进制转 RGB，输出 "r g b" | `#ff0000` | `255 0 0` |
| 转换 | `rgb_to_hex` | RGB 转十六进制 | `255 0 0` | `#ff0000` |
| 转换 | `hex_to_hsl` | 转 HSL，输出 "h s% l%" | `#ff0000` | `0 100 50` |
| 转换 | `hsl_to_hex` | HSL 转十六进制 | `0 100 50` | `#ff0000` |
| 转换 | `hex_to_hsv` | 转 HSV，输出 "h s% v%" | `#ff0000` | `0 100 100` |
| 转换 | `hsv_to_hex` | HSV 转十六进制 | `0 100 100` | `#ff0000` |
| 转换 | `hex_to_cmyk` | 转 CMYK，输出 "c% m% y% k%" | `#ff0000` | `0 100 100 0` |
| 调整 | `lighten` | 提高亮度，--amount 百分点 | `#808080` | `#8d8d8d` |
| 调整 | `darken` | 降低亮度，--amount 百分点 | `#808080` | `#787878` |
| 调整 | `saturate` | 提高饱和度，--amount 百分点 | `#808080` | `#c04141` |
| 调整 | `desaturate` | 降低饱和度，--amount 百分点 | `#ff0000` | `#bf4040` |
| 调整 | `complement` | 互补色 | `#ff0000` | `#00ffff` |
| 调整 | `invert` | 反色 | `#ff0000` | `#00ffff` |
| 调整 | `grayscale` | 转灰度（按感知亮度加权） | `#ff0000` | `#363636` |
| 组合 | `mix` | 混合两个颜色，第 3 个值为 B 的占比(0~100，默认 50) | `#ff0000 #0000ff` | `#800080` |
| 组合 | `gradient` | 生成渐变色卡，输入 "颜色A 颜色B 步数"，每行一个色值 | `#000000 #ffffff 3` | `#000000 ⏎ #808080 ⏎ #ffffff` |
| 度量 | `luminance` | WCAG 相对亮度 0~1 | `#ffffff` | `1` |
| 度量 | `contrast_ratio` | 两色对比度（WCAG 1~21），并给出 AA/AAA 结论 | `#000000 #ffffff` | `21 A AA AAA` |
| 度量 | `is_light` | 是否为浅色，输出 true/false | `#ffffff` | `true` |
| 度量 | `is_dark` | 是否为深色，输出 true/false | `#000000` | `true` |
| 度量 | `distance` | 两色的 RGB 欧氏距离 | `#000000 #ffffff` | `441.67295593` |

## image_tool

图像处理工具 — 零依赖 PNG 编解码：信息统计、缩放裁剪旋转、色彩调整、模糊锐化边缘、图像比较与字符画

```
image_tool <function> -i input.desc -o output.desc
```

| 分组 | 函数 | 说明 | input.desc | output.desc |
| --- | --- | --- | --- | --- |
| 信息 | `info` | 输出图像基本信息 | — | — |
| 信息 | `stats` | 输出平均色与亮度统计 | — | — |
| 信息 | `histogram` | 灰度直方图，--bins 桶数（默认 16） | — | — |
| 几何 | `resize` | 缩放，--width/--height 给一个则按比例自适应 | — | — |
| 几何 | `thumbnail` | 生成 --size × --size 内的缩略图（保持比例，透明填充） | — | — |
| 几何 | `crop` | 裁剪，--x --y --w --h | — | — |
| 几何 | `rotate` | 旋转 --angle 度（90/180/270，逆时针为正） | — | — |
| 几何 | `flip` | 镜像翻转，--dir h(水平)|v(垂直) | — | — |
| 颜色 | `grayscale` | 转灰度（感知亮度加权） | — | — |
| 颜色 | `invert` | 反色 | — | — |
| 颜色 | `brightness` | 调整亮度，--amount 为 -255~255 的增量 | — | — |
| 颜色 | `contrast` | 调整对比度，--amount 为系数（1 为不变） | — | — |
| 颜色 | `saturate` | 调整饱和度，--amount 为系数（0 为去色） | — | — |
| 颜色 | `sepia` | 复古棕褐色调 | — | — |
| 颜色 | `threshold` | 二值化，--level 阈值 0~255 | — | — |
| 滤镜 | `blur` | 盒式模糊，--radius 半径 | — | — |
| 滤镜 | `sharpen` | 锐化（3x3 卷积） | — | — |
| 滤镜 | `edge` | Sobel 边缘检测 | — | — |
| 滤镜 | `emboss` | 浮雕效果 | — | — |
| 比较 | `diff` | 比较两张图：input 两行分别为图片路径，输出差异统计 | — | — |
| 比较 | `to_text` | 把图像转为字符画，--cols 字符列数 | — | — |

## finance_tool

金融计算工具 — 单利复利、现值终值、NPV/IRR、等额本息摊销、ROI/CAGR、盈亏平衡与折旧（利率统一用小数，0.05=5%）

```
finance_tool <function> -i input.desc -o output.desc
```

| 分组 | 函数 | 说明 | input.desc | output.desc |
| --- | --- | --- | --- | --- |
| 利息 | `simple_interest` | 单利利息：本金 × 利率 × 年数 | `10000 0.05 3` | `1500` |
| 利息 | `compound_interest` | 复利终值 A = P(1 + r/n)^(nt) | `10000 0.05 1 3` | `11576.25` |
| 利息 | `continuous_interest` | 连续复利终值 A = P·e^(rt) | `10000 0.05 3` | `11618.342422` |
| 利息 | `ear` | 有效年利率 EAR = (1 + r/n)^n - 1 | `0.12 12` | `0.126825030132` |
| 利息 | `rule_of_72` | 本金翻倍的估算年数 72 / (利率×100) | `0.06` | `12` |
| 现值终值 | `fv` | 复利终值 FV = PV(1 + r)^n | `1000 0.05 10` | `1628.894627` |
| 现值终值 | `pv` | 现值 PV = FV / (1 + r)^n | `1628.894627 0.05 10` | `1000` |
| 现值终值 | `npv` | 净现值：第 1 个值为贴现率，其余为各期现金流 | `0.1 -1000 300 400 500` | `-21.0368144252` |
| 现值终值 | `irr` | 内部收益率（使 NPV=0 的贴现率） | `-1000 300 400 500` | `0.0889633946933` |
| 贷款 | `pmt` | 等额还款每期金额 PMT = P·i / (1 - (1+i)^-n) | `100000 0.005 120` | `1110.20501942` |
| 贷款 | `amortization` | 等额本息摊销表，每行 "期次 利息 本金 剩余余额" | `1000 0.1 3` | `1 100 302.114804 697.885196 ⏎ 2 69.78852 332.326284 365.558912 ⏎ 3 36.555891 365.558912 0` |
| 贷款 | `total_interest` | 等额本息总利息 | `1000 0.1 3` | `206.344410876` |
| 投资 | `roi` | 投资回报率 (收益 - 成本) / 成本 | `1200 1000` | `0.2` |
| 投资 | `cagr` | 复合年增长率 (末值/初值)^(1/年数) - 1 | `1000 2000 5` | `0.148698355` |
| 投资 | `margin` | 毛利率 (收入 - 成本) / 收入 | `200 150` | `0.25` |
| 投资 | `breakeven` | 盈亏平衡销量 = 固定成本 / (单价 - 单位变动成本) | `10000 50 30` | `500` |
| 投资 | `payback` | 静态回收期（年）：第 1 个值为初始投资(正数)，其余为各年净现金流 | `300 100 150 200` | `2.25` |
| 投资 | `depreciation` | 折旧：--method sl(直线)|ddb(双倍余额递减)|sy(年数总和) | `10000 1000 5` | `1800 ⏎ 1800 ⏎ 1800 ⏎ 1800 ⏎ 1800` |

