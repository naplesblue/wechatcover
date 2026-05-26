# 品牌视觉系统（风格预设：简洁科技 · 单张毛玻璃信息卡）

> 可切换风格预设。Apple 产品 + 极简：**清晰背景** + **一张**半透明毛玻璃信息卡（作焦点）+ 细白描边。
> 关键：封面**要有重点**——磨砂玻璃信息卡**只有一张**（不做成多卡仪表盘）；背景清晰锐利、玻璃只模糊卡后；文字只在卡上。
> 用法：`--brand-system presets/clean-glasscard.md`

## 主色板（清透蓝橙 · 浅而通透）

设计哲学：**干净、高级、不像广告，且有明确重点**。在**清晰锐利**的浅色背景上，漂浮**一张**半透明毛玻璃信息卡（细白边光、柔影）作为绝对焦点——标题与关键信息都在这张卡上。**磨砂玻璃只模糊卡片正后方**（背景其余清晰，玻璃才读得出来）。

| 角色 | 颜色 | Hex | 用法 | 画面占比 |
|---|---|---|---|---|
| **清晰背景** | 浅蓝↔暖白柔光 | `#EAF0F3` ↔ `#F4ECE0` | **清晰 in-focus** 场景，克制，作玻璃模糊的来源 | **≥50%** |
| 毛玻璃卡（chrome） | 半透明白磨砂 + 细白边光 | 白(半透明) / 边光近白 | **一张**圆角毛玻璃卡，承载文字，只模糊卡后 | 25-35% |
| 文字 | 深蓝 + 清透蓝 | `#143A52` / `#3E78A6` | 标题、副标、tagline | 10-15% |
| **点睛** | 亮橙 | `#FB5717` | 标题下划线 / 一个小图标（一处） | ≤5% |

**关键约束**：**只有一张玻璃卡**（不要做成多卡仪表盘）；这张卡是**绝对焦点 / 重点**；背景**清晰锐利**（不要整张虚化）、玻璃**只模糊卡后**；卡有细白边光 + 柔影 + 卡后模糊；**不像广告**。

## 量化规格（七维）

- **版面**：**一张**玻璃信息卡作绝对焦点（居中或黄金分割），大留白；背景清晰、克制。
- **形态**：圆角矩形毛玻璃卡 + **细白边光（rim）** + 卡下柔阴影 + 卡后可见模糊；**一张，不要多张**。
- **材质 / 光（核心）**：背景**清晰 in-focus**；毛玻璃卡**只模糊正后方**（frosted blur-behind）+ 细白边光 + 柔阴影 → 卡"浮起"；通透、不高反光。
- **密度**：低——一张卡 + 极简，留白充足。

## 字体规范

| 用途 | 字体 | 备注 |
|---|---|---|
| 中文主标题 | 思源黑体（粗/中） | 现代无衬线，大而清晰，卡上的主视觉 |
| 副标 / tagline | 思源黑体（细/中） | 卡上，层级分明 |
| 英文 | SF 风 / Inter | 现代无衬线 |

## 场景物的具体度

**一张玻璃信息卡**承载标题与关键信息（text on card）；背景是**清晰、与主题相关的克制场景**（作玻璃模糊的来源），不抢焦。**重点就是这一张卡**——不要把画面铺成一堆卡片 / widget。

## 工艺质感关键词（技法与质感，必须出现在 prompt 中）

```
CLEAN TECH aesthetic — Apple-product + minimalism, premium, NOT advertising, with a SINGLE clear focus
SHARP, IN-FOCUS background scene (crisp, NOT pre-blurred) — light, clean, topic-related, restrained
ONE frosted translucent glass INFO CARD (rounded rectangle) as the single FOCAL element
the card BLURS only the area directly behind it (so the rest of the background stays sharp — that contrast reads as glass)
the card has a bright THIN WHITE rim-light edge, a soft drop shadow, floating above the scene
the title and key info live ON this one card (bold sans-serif title + short orange underline + a small English subtitle / one tagline)
clear emphasis: this single card dominates; everything else is calm and restrained; generous light space
modern clean sans-serif; clear blue text + one orange accent; high-end, designed, NOT salesy
```

## 视觉黑名单（本风格专属 anti-slop，必须显式列出）

```
ONLY ONE frosted glass info card — do NOT make a multi-card dashboard / widget grid (a cover needs ONE clear focus)
glass = the ONE info card (frosted / semi-transparent matte) — NOT clear refractive lens, NOT solid; NOT objects made of glass
the background is SHARP / in-focus — do NOT pre-blur the whole scene (the card blurs only behind itself)
the card must read as floating glass: visible blur-behind + thin white rim-light + soft shadow
text lives ON the card; ONE focal point with clear emphasis
NOT advertising — NO starbursts, NO price tags, NO promo badges, NO salesy clutter
NO rainbow / prism glass, NO heavy gloss / mirror reflections, NO neon, NO busy or saturated background
```

## 长宽比 / 尺寸

微信公众号首图：**47:20**（默认 1920×816 + quality=low）。

## 调性映射（内容类型 → 视觉调性）

| 内容类型 | 光线 | 构图 |
|---|---|---|
| 科技 / 产品 / 信息 | clean、清晰背景 | 一张玻璃信息卡作焦点 + 留白 |
| 概念 | 干净 | 一张卡承载核心 + 大留白 |
