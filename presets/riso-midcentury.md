# 品牌视觉系统（风格预设：复古中世纪现代 · risograph 颗粒）

> 可切换风格预设。复古中世纪现代主义海报插画 + 胶印 / risograph 颗粒质感，低饱和蓝橙绿，梦幻怀旧安静。
> 比「教科书包豪斯」更柔、更梦幻、更当下。用法：`--brand-system presets/riso-midcentury.md`

## 主色板（低饱和蓝橙绿 + 暖纸）

设计哲学：**梦幻、怀旧、安静**。扁平色块 + 颗粒胶印 + 轻微喷枪柔影，低饱和的蓝橙绿落在暖纸上，像一张有年代感的丝网 / 胶印海报。

| 角色 | 颜色 | Hex | 用法 | 画面占比 |
|---|---|---|---|---|
| **主导底** | 暖纸 / 米白 | `#F2EAD8` | 纸纹底，呼吸感 | **≥45%** |
| 蓝 | 低饱和尘蓝 | `#3D5566` | 扁平色块 / 线 | 15-25% |
| 绿 | 柔和鼠尾草绿 | `#6E7F63` | 扁平色块 | 10-20% |
| 橙 | 低饱和暖橙 | `#C9714E` | 扁平色块 | 10-15% |
| **点睛** | 稍亮橙 | `#E0843F` | 一处点亮 | ≤5% |

**关键约束**：整体**低饱和、灰调**；色块扁平但靠**颗粒 / 套印微偏移**出旧感；阴影是**柔和喷枪渐变**、不是硬投影。

## 量化规格（七维）

- **版面**：海报式构图，大标题，松散网格，留白。
- **形态**：扁平色块 + 简化的有机 / 几何形；**轻微喷枪柔影**（soft gradient shading）。
- **质感（核心）**：risograph / 胶印颗粒、纸纹、套印轻微错位、网点感——**必须有颗粒**，不是干净矢量。
- **密度**：中——色块构成，不堆砌。

## 字体规范

| 用途 | 字体 | 备注 |
|---|---|---|
| 中文主标题 | 思源宋体 / 思源黑体（粗） | 复古海报感、强层级 |
| 正文/副文 | 思源黑体 | 克制 |
| 英文 | 复古几何无衬线 | 海报味 |

## 场景物的具体度

信息类：一个简化为色块的具体物体作焦点；情绪类：梦幻怀旧的氛围意象（无文字），靠色与光传情。

## 工艺质感关键词（技法与质感，必须出现在 prompt 中）

```
RETRO MID-CENTURY MODERN POSTER ILLUSTRATION
risograph / offset-print grain texture — visible paper tooth, ink grain, halftone, slight misregistration
flat color blocks with subtle overprint; gentle AIRBRUSH soft shadows (soft gradient shading)
low-saturation muted palette: dusty blue, soft sage green, muted warm orange on warm paper
dreamy, nostalgic, quiet editorial illustration mood
limited palette, designed-not-rendered, matte print finish, grainy
```

## 视觉黑名单（本风格专属 anti-slop，必须显式列出）

```
NO clean digital vector look — it MUST have print grain / risograph texture
NO photorealism, NO 3D, NO glossy, NO chrome
NO high-saturation / neon colors (palette is muted, dusty, low-saturation)
NO hard drop shadows (shadows are soft airbrush gradients only)
NO stark textbook-Bauhaus primary-color hard graphic — this is softer, grainy, dreamy
NO cluttered busy composition — keep it quiet and calm
NO tech cliché (circuit, glow, HUD, data stream)
```

## 长宽比 / 尺寸

微信公众号首图：**47:20**（默认 1920×816 + quality=low）。

## 调性映射（内容类型 → 视觉调性）

| 内容类型 | 光线 | 构图 |
|---|---|---|
| 信息 / 概念 | 柔和、怀旧 | 海报式、大标题 + 色块物体 |
| 情绪 / 人文 | 梦幻暮光 | 氛围意象、无文字、大留白 |
