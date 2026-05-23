# 品牌视觉系统（预设：冷工业灰）

> 风格定位：科技公司 / 产品发布 / 硬核技术。冷静、精密、克制。**默认无 IP 角色。**
> 用法：`node gen_cover.mjs --from-text article.md --out cover.png --brand-system presets/cold-industrial.md`

## 主色板（按优先级使用）

设计哲学：**克制的精密**。冷调混凝土灰作为整体阅读底，钢蓝作为品牌身份信号精确点缀，
一处工业安全橙点亮焦点。图应该读起来像「**冷灰底上的钢蓝技术插画**」，干净、有分寸。

| 角色 | 颜色 | Hex | 用法 | 画面占比 |
|---|---|---|---|---|
| **主导背景** | 混凝土浅灰 | `#E4E7EA` / `#DCE0E4` | 整体底色，冷静理性的阅读面 | **≥50%** |
| **品牌签名色** | 钢蓝 | `#20384F` | 仅用在关键标识：主标题、主体物轮廓、焦点物 | 15-25% |
| 辅助 | 石板灰 | `#5A6672` | 阴影、次要文字、支撑结构 | 10-15% |
| 强调 | 钴蓝 | `#0F5C8C` | 最重要的数字/技术参数（≤2 处） | 5-10% |
| 点睛 | 工业安全橙 | `#E8703A` | 唯一点睛色，一处点亮焦点 | ≤5% |

**关键约束**：
- 钢蓝不要主导画面——它是精确的技术签名，不是音量
- 冷灰底是整体气质的来源，要克制、留白、有秩序感
- 唯一暖色（安全橙）只点一处，制造工业现场的视觉锚

**禁止颜色**：
- ❌ 纯黑 `#000000`、纯白 `#FFFFFF`
- ❌ 高饱和荧光色、霓虹
- ❌ 多色彩虹渐变、generic「科技蓝」渐变
- ❌ 多个点睛色并列（安全橙只能一处）

## 字体规范

| 用途 | 字体 | 备注 |
|---|---|---|
| 中文主标题 | 思源黑体 Bold | 无衬线，工业精密感 |
| 中文小标题/正文 | 思源黑体 | 清晰、中性 |
| 英文 / 参数 | IBM Plex Sans / IBM Plex Mono | 等宽用于技术数字 |

**视觉权重原则**：
- 主标题占画面视觉权重 ≥40%
- 数字/参数用钴蓝强调，作为技术钩子的视觉抓手

## IP 角色规范

**本预设默认不使用 IP 角色**（科技公司风通常不带吉祥物）。
如确需角色（`--with-character`）：保持中性、极简、与冷调一致，避免任何萌系/拟人化吉祥物；
角色服饰用钢蓝或石板灰，与场景互动而非摆 pose。

## 场景物的具体度

画面必须有**一个具体的、可命名的物体**作为视觉焦点（一台设备、一块主板的外壳、一个参数面板、
一只手在操作旋钮）。不能是抽象的「数据流」「发光的脑子」「几何渐变」。

## 工艺质感关键词（必须出现在 prompt 中）

```
FLAT EDITORIAL ILLUSTRATION, clean precise technical linework
ink illustration aesthetic with cool limited palette
matte finish, paper texture, designed-not-rendered
restrained, orderly composition with intentional negative space
NO photorealism, NO CGI, NO cinematic rendering, NO 3D realism
NO glossy plastic finish, NO chrome, NO photographic depth-of-field
```

**关键认识**：GPT-Image-2 默认渲染方向是 cinematic/photorealistic。要出 editorial illustration
必须用否定句式强压：必须显式 NO photorealism / NO CGI / NO cinematic。

**禁止在 prompt 中出现真实出版物/艺术家名称**——即使作为「参考风格」也会触发 OpenAI 安全审核。
用形容性描述替代，如："clean technical editorial illustration"、"cool-toned ink illustration"。

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
```

每一条都对应一个被烂用过 1 万次的 AI 出图视觉模板——科技题材尤其要避开它们。

## 长宽比 / 尺寸

| 用途 | 宽高比 | 推荐分辨率 | 成本/张 |
|---|---|---|---|
| **微信公众号首图（默认）** | **47:20** ≈ 2.35:1 | **1920×816** + quality=low | ~¥0.02 |
| 微信公众号首图（高清版手动）| 47:20 | 2400×1024 + quality=medium | ~¥0.24 |

**API 硬约束**：GPT-Image-2 要求 width 和 height 都能被 16 整除。1920×816 与精确 47:20 差 0.12%，肉眼不可见。

## 调性映射（内容类型 → 视觉调性）

| 内容类型 | 光线 | 构图 | 强调色用法 |
|---|---|---|---|
| 产品发布 | dramatic side light | 主体居中 | 钴蓝用在新产品参数 |
| 技术深度 | cool clinical | 黄金分割右 | 钴蓝用在数据/数字 |
| 行业观察 | flat even | 黄金分割左 | 安全橙用在对比焦点 |

如果不确定，默认走「技术深度」组合。
