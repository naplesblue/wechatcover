# 品牌视觉系统（预设：学术纯排版）

> 风格定位：深度长文 / 论述 / 研究笔记。排版即设计，克制、有留白、有权威感。**无 IP 角色。**
> 用法：`node gen_cover.mjs --from-text article.md --out cover.png --brand-system presets/academic.md`

## 主色板（按优先级使用）

设计哲学：**排版即设计**。暖纸大面积留白作为整体阅读面，单一墨色承担标题与文字，
一处印章朱红点睛。图应该读起来像「**一页讲究的印刷正文**」——靠字体、间距、层级，而非插画堆叠。

| 角色 | 颜色 | Hex | 用法 | 画面占比 |
|---|---|---|---|---|
| **主导背景** | 暖牙白 | `#FBF6EA` / `#F7F1E3` | 整体底色，大量留白是气质来源 | **≥60%** |
| **墨色（签名）** | 深墨 | `#2B2A26` | 主标题、正文、稀疏线条（**非纯黑**）| 15-25% |
| 辅助 | 暖灰 | `#9A9286` | 次要文字、分隔线、退后元素 | 10-15% |
| 点睛 | 印章朱红 | `#B23A2E` | 唯一点睛：一个关键数字 / 印章 / 批注记号 | ≤5% |

**关键约束**：
- 留白不是空，是排版的一部分——大面积暖纸是「呼吸」，要有意经营
- 强调靠**字号 / 字重 / 位置**，不是靠加颜色（除唯一的朱红点睛）
- 几乎单色：暖纸 + 墨 + 一处朱红，克制到底
- 印章朱红只点一处（一个数字、一枚印章、一道批注），是全图唯一的暖色火花

**禁止颜色**：
- ❌ 纯黑 `#000000`（用深墨替代）、纯白 `#FFFFFF`（用暖牙白替代）
- ❌ 高饱和荧光色、霓虹
- ❌ 多色彩虹渐变
- ❌ 多个点睛色并列（朱红只能一处）

## 字体规范

字体是这个风格的主角。

| 用途 | 字体 | 备注 |
|---|---|---|
| 中文主标题 | 思源宋体 | 衬线，学术权威感，大字号主视觉 |
| 中文正文 / 引文 | 思源宋体 / 思源黑体 | 清晰、有古典书卷气 |
| 英文 / 数字 | 衬线（如 Source Serif） | 与中文宋体协调 |

**视觉权重原则**：
- 主标题占画面视觉权重 ≥45%（排版风里标题尤其要大、要稳）
- 可用一道细分隔线、一个引号、一个页码感的小元素强化「印刷页」气质

## IP 角色规范

**本预设不使用 IP 角色**（学术/论述类靠排版立住）。`--with-character` 在本预设下忽略。

## 场景物的具体度

排版优先，插画极简。焦点可以是：
- **纯排版构图**（大标题 + 留白 + 一道线 + 一处朱红数字），或
- **一个克制的母题**（一本摊开的书、一个脚注记号、一段被框起的引文、一张极简图表片段）

不要堆叠多个插画元素；不要抽象「数据流」「发光的脑子」「几何渐变」。

## 工艺质感关键词（必须出现在 prompt 中）

```
MINIMAL EDITORIAL TYPOGRAPHY LAYOUT, typography-as-image
sparse hand-drawn linework, generous warm-paper whitespace
ink on paper, matte finish, designed-not-rendered
restrained, classic printed-page aesthetic
NO photorealism, NO CGI, NO cinematic rendering, NO 3D realism
NO glossy plastic finish, NO chrome, NO photographic depth-of-field
NO cluttered illustration — let type and whitespace lead
```

**关键认识**：GPT-Image-2 默认渲染方向是 cinematic/photorealistic，且倾向把画面填满。
本风格要反向强压：必须显式 NO photorealism / NO CGI / NO cinematic，并强调 typography-led +
generous whitespace，否则它会塞满插画、丢掉排版的克制。

**禁止在 prompt 中出现真实出版物/艺术家名称**——即使作为「参考风格」也会触发 OpenAI 安全审核。
用形容性描述替代，如："classic printed-page typography"、"restrained editorial layout"。

## 视觉黑名单（必须在 prompt 的 NEGATIVE 部分显式列出）

```
NO abstract neural network diagrams
NO glowing brain or digital head
NO robot hand shaking human hand
NO circuit board background
NO data stream / particle flows
NO gradient geometric shapes (rings, polygons, blobs)
NO VR goggles or AR headsets
NO holographic UI floating in air
NO futuristic city skyline
NO chrome / metallic AI face
NO binary code rain / matrix-style background
NO generic "tech blue" gradient
NO glossy plastic finish
NO cluttered busy composition
```

## 长宽比 / 尺寸

| 用途 | 宽高比 | 推荐分辨率 | 成本/张 |
|---|---|---|---|
| **微信公众号首图（默认）** | **47:20** ≈ 2.35:1 | **1920×816** + quality=low | ~¥0.02 |
| 微信公众号首图（高清版手动）| 47:20 | 2400×1024 + quality=medium | ~¥0.24 |

**API 硬约束**：GPT-Image-2 要求 width 和 height 都能被 16 整除。1920×816 与精确 47:20 差 0.12%，肉眼不可见。

## 调性映射（内容类型 → 视觉调性）

| 内容类型 | 光线 | 构图 | 强调用法 |
|---|---|---|---|
| 论述 / 评论 | flat even（无戏剧光）| 大标题 + 留白 | 朱红用在核心论点的一个数字/字眼 |
| 研究 / 深度 | cool clinical | 黄金分割，左对齐排版 | 朱红用在关键数据 |
| 书评 / 引文 | soft natural | 引文居中 | 朱红用在引号 / 批注记号 |

如果不确定，默认走「论述 / 评论」组合。
