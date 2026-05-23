# 品牌视觉系统（预设：深色编辑风）

> 风格定位：观点 / 深度评论 / 长文。沉静、聚焦、有夜间沉浸感。**默认无 IP 角色。**
> 用法：`node gen_cover.mjs --from-text article.md --out cover.png --brand-system presets/dark-editorial.md`

## 主色板（按优先级使用）

设计哲学：**沉静的聚焦**。深墨底色作为整体阅读面，暖米白作为前景插画与文字，
一处暖金作为发光焦点。图应该读起来像「**深墨纸上发光的米白插画**」，安静、有重量、聚焦。

| 角色 | 颜色 | Hex | 用法 | 画面占比 |
|---|---|---|---|---|
| **主导背景** | 深墨蓝 / 炭黑（非纯黑） | `#1B2230` / `#161A22` | 整体底色，夜间沉浸的阅读面 | **≥50%** |
| **前景/签名色** | 暖米白 | `#F0E7D6` | 主标题、主体物轮廓、前景插画线 | 15-25% |
| 辅助 | 石青灰 | `#6E7E90` | 次要文字、阴影、退后的支撑元素 | 10-15% |
| 强调 | 暖金 | `#E3B341` | 最重要的数字/标题点睛（发光感，≤2 处） | 5-10% |
| 点睛 | 朱红 | `#D14A3A` | 唯一点睛色，一处点亮 | ≤5% |

**关键约束**：
- 深墨底是气质核心：要「深」但**绝不用纯黑 #000000**，用带蓝调的深墨
- 前景米白是「光」，承担可读性与插画线条，要从暗底里浮出来
- 暖金是发光焦点，用在最关键的数字/字眼上，制造「夜里的一束光」
- 暗部不是空白，是**有意设计的暗呼吸空间**（dark negative space），不是被遗忘的死区

**禁止颜色**：
- ❌ 纯黑 `#000000`（用深墨替代）、纯白 `#FFFFFF`（用暖米白替代）
- ❌ 高饱和荧光色、霓虹
- ❌ 多色彩虹渐变
- ❌ 多个点睛色并列（朱红只能一处）

## 字体规范

| 用途 | 字体 | 备注 |
|---|---|---|
| 中文主标题 | 思源宋体 | 衬线，在深色上优雅、有编辑权威感 |
| 中文小标题/正文 | 思源黑体 Light | 在暗底上清晰不刺眼 |
| 英文 | 衬线 / Inter | 与中文搭配协调 |

**视觉权重原则**：
- 主标题占画面视觉权重 ≥40%，米白或暖金，从暗底浮出
- 标题是夜里的主光源，要够亮够大

## IP 角色规范

**本预设默认不使用 IP 角色**（观点/评论类通常无吉祥物）。
如确需角色（`--with-character`）：用米白/石青描绘，置于暗底中由暖金侧光勾边，
与场景互动而非摆 pose；避免任何明亮萌系吉祥物（与沉静气质冲突）。

## 场景物的具体度

画面必须有**一个具体的、可命名的物体**作为视觉焦点（一盏台灯、一本摊开的书、一支钢笔、
一扇窗、一只握着的手）。不能是抽象的「数据流」「发光的脑子」「几何渐变」。

## 工艺质感关键词（必须出现在 prompt 中）

```
FLAT EDITORIAL ILLUSTRATION, ink illustration on dark textured paper
luminous limited palette glowing against a deep ink ground
hand-drawn linework, visible brush strokes, matte finish, designed-not-rendered
intentional DARK negative space (designed breathing room, not empty)
NO photorealism, NO CGI, NO cinematic rendering, NO 3D realism
NO glossy plastic finish, NO chrome, NO photographic depth-of-field
NO pure black background (use deep ink, not #000000)
```

**关键认识**：GPT-Image-2 默认渲染方向是 cinematic/photorealistic。要出 editorial illustration
必须用否定句式强压：必须显式 NO photorealism / NO CGI / NO cinematic。深色尤其容易被渲染成
cinematic 夜景大片——务必强调 flat illustration + matte。

**禁止在 prompt 中出现真实出版物/艺术家名称**——即使作为「参考风格」也会触发 OpenAI 安全审核。
用形容性描述替代，如："moody editorial ink illustration on dark paper"。

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
NO neon glow, NO cyberpunk lighting
NO glossy plastic finish
```

## 长宽比 / 尺寸

| 用途 | 宽高比 | 推荐分辨率 | 成本/张 |
|---|---|---|---|
| **微信公众号首图（默认）** | **47:20** ≈ 2.35:1 | **1920×816** + quality=low | ~¥0.02 |
| 微信公众号首图（高清版手动）| 47:20 | 2400×1024 + quality=medium | ~¥0.24 |

**API 硬约束**：GPT-Image-2 要求 width 和 height 都能被 16 整除。1920×816 与精确 47:20 差 0.12%，肉眼不可见。

## 调性映射（内容类型 → 视觉调性）

| 内容类型 | 光线 | 构图 | 强调色用法 |
|---|---|---|---|
| 观点评论 | dramatic single light source | 主体居中 | 暖金用在核心论点字眼 |
| 深度长文 | warm glow from one side | 黄金分割右 | 暖金用在关键数字 |
| 人物动态 | golden rim light | 主体居中 | 朱红用在人物焦点 |

如果不确定，默认走「观点评论」组合。
