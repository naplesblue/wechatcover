# 品牌视觉系统（预设：暖橘活泼）

> 风格定位：个人 newsletter / 生活方式 / 轻松科普。明亮、友好、有活力。**可选 IP 角色。**
> 用法：`node gen_cover.mjs --from-text article.md --out cover.png --brand-system presets/warm-orange.md`
> 带角色：再加 `--with-character`

## 主色板（按优先级使用）

设计哲学：**明亮的友好**。暖奶油底色作为整体阅读面，暖橘作为品牌身份信号，
一处鸭青互补色点亮画面。图应该读起来像「**暖纸上活泼的橘色插画**」，轻松、亲和、不刺眼。

| 角色 | 颜色 | Hex | 用法 | 画面占比 |
|---|---|---|---|---|
| **主导背景** | 暖奶油 / 浅杏 | `#FFF3E2` / `#FDEAD0` | 整体底色，温暖的阅读面 | **≥50%** |
| **品牌签名色** | 暖橘 | `#E8743B` | 主标题、主体物轮廓、焦点物 | 15-25% |
| 辅助 | 琥珀黄 | `#F2B23E` | 次要元素、阳光感、支撑插画 | 10-15% |
| 强调 | 砖红 | `#C8472B` | 最重要的数字/文字（≤2 处） | 5-10% |
| 点睛 | 鸭青 | `#2A9D8F` | 唯一点睛色（橘的互补色），一处点亮 | ≤5% |

**关键约束**：
- 暖橘是主调性也是签名，但仍要让暖奶油底 ≥50%，避免整张糊成橘色
- 鸭青是唯一冷色点睛，制造活泼的对比火花，只点一处
- 整体要明亮愉悦，不要脏、不要暗沉

**禁止颜色**：
- ❌ 纯黑 `#000000`、纯白 `#FFFFFF`
- ❌ 高饱和荧光色、霓虹
- ❌ 多色彩虹渐变
- ❌ 暗沉脏灰（与「活泼」气质冲突）
- ❌ 多个点睛色并列（鸭青只能一处）

## 字体规范

| 用途 | 字体 | 备注 |
|---|---|---|
| 中文主标题 | 霞鹜文楷 / 圆润人文衬线 | 温暖、亲和、有手写感 |
| 中文小标题/正文 | 思源黑体 | 清晰可读 |
| 英文 | Inter / 圆润无衬线 | 友好基调 |

**视觉权重原则**：
- 主标题占画面视觉权重 ≥40%
- 标题可略带俏皮，但仍要清晰、是封面主视觉

## IP 角色规范

**可选**（`--with-character` 启用）。本预设建议的角色形象：

| 元素 | 描述 |
|---|---|
| **圆润亲和的卡通形象** | 暖橘 / 奶油配色，大眼睛，表情友好，3D 玩具感（designer vinyl figure 质感）|
| **可有一个小标志物** | 如手里拿支笔/一杯热饮，强化「个人创作者」的亲切感 |
| 表情 | 好奇 / 开心 / 惊喜 / 专注，根据文章调性 |

> 角色具体形象建议用参考图注入（规划中的功能），文字描述难做到每次一致。

### 角色与场景的关系
角色必须与画面里的物/事件**互动**（看、指、拿、检查），不是站在前面摆 pose。

### 不能有的元素（角色启用时）
- ❌ 渔夫帽
- ❌ 程序员 stereotype（格子衫、带 logo 卫衣）
- ❌ stereotypical「科技感」装饰（VR 眼镜、机械臂）
- ❌ 阴森/恐怖表情（与活泼气质冲突）

## 场景物的具体度

画面必须有**一个具体的、可命名的物体**作为视觉焦点（一杯咖啡、一本翻开的书、一台相机、
一盆绿植、一封信）。不能是抽象的「数据流」「几何渐变」。

## 工艺质感关键词（必须出现在 prompt 中）

```
FLAT EDITORIAL ILLUSTRATION, warm playful hand-drawn style
gouache / crayon texture feel, lively brush strokes
matte finish, paper texture, designed-not-rendered
limited warm palette with intentional negative space
NO photorealism, NO CGI, NO cinematic rendering, NO 3D realism
NO glossy plastic finish, NO chrome, NO photographic depth-of-field

(when character involved)
designer vinyl figure quality — stylized 3D, NOT realistic 3D
```

**关键认识**：GPT-Image-2 默认渲染方向是 cinematic/photorealistic。要出 editorial illustration
必须用否定句式强压：必须显式 NO photorealism / NO CGI / NO cinematic。

**禁止在 prompt 中出现真实出版物/艺术家名称**——即使作为「参考风格」也会触发 OpenAI 安全审核。
用形容性描述替代，如："warm playful editorial illustration"、"hand-drawn gouache illustration"。

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

## 长宽比 / 尺寸

| 用途 | 宽高比 | 推荐分辨率 | 成本/张 |
|---|---|---|---|
| **微信公众号首图（默认）** | **47:20** ≈ 2.35:1 | **1920×816** + quality=low | ~¥0.02 |
| 微信公众号首图（高清版手动）| 47:20 | 2400×1024 + quality=medium | ~¥0.24 |

**API 硬约束**：GPT-Image-2 要求 width 和 height 都能被 16 整除。1920×816 与精确 47:20 差 0.12%，肉眼不可见。

## 调性映射（内容类型 → 视觉调性）

| 内容类型 | 光线 | 构图 | 强调色用法 |
|---|---|---|---|
| 个人随笔 | warm natural | 灵活 | 自由 |
| 生活方式 | golden hour | 主体居中 | 砖红用在主体 |
| 轻松科普 | soft natural | 黄金分割左 | 鸭青用在对比物 |

如果不确定，默认走「个人随笔」组合。
