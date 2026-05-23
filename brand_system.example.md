# 品牌视觉系统（示例配置）

> 这是一份**填好的样例**：「暖纸蓝 + 青椒 IP」风格。
> 想做自己的品牌：参照 `brand_system.template.md` 的结构，把下面的色值、字体、IP 改成你自己的。
> 仓库默认的 `brand_system.md` 就是这份配置的副本（开箱即跑）。

## 主色板（按优先级使用）

设计哲学：**温和的锋利**。暖纸调性作为整体阅读底，蓝色作为品牌身份信号点缀其中。
图应该读起来像「**暖纸上的蓝色插画**」，不是「蓝色画面」。

| 角色 | 颜色 | Hex | 用法 | 画面占比 |
|---|---|---|---|---|
| **主导背景** | 暖米 / 牙白 | `#FAF3DD` / `#FDF6E3` | 整体底色，纸质阅读感的来源 | **≥50%** |
| **品牌签名色** | 深海蓝 | `#1B4965` | 仅用在关键标识元素：主标题、主体物轮廓、焦点物 | 15-25% |
| 辅助 | 靛蓝 | `#3D5A80` | 阴影、次要文字、支撑元素 | 10-15% |
| 强调 | 皇家蓝 | `#293B8A` | 最重要的数字/文字（≤2 处） | 5-10% |
| 点睛 | 砖橘 | `#E07A5F` | 唯一点睛色，一处点亮 | ≤5% |

**关键约束**：
- 蓝色不要主导画面——它是「潜移默化的品牌调性」，不是音量
- 暖底纸质感是用户观感第一位的来源
- 参照高端印刷杂志的页面质感：大量留白 + 暖底 + 品牌色精确点睛

**禁止颜色**：
- ❌ 纯黑 `#000000`、纯白 `#FFFFFF`（缺乏温度）
- ❌ 高饱和荧光色（霓虹粉、电光蓝、毒绿等）
- ❌ 多色彩虹渐变
- ❌ 多个强调色并列（点睛色只能一个）

## 字体规范

| 用途 | 字体 | 备注 |
|---|---|---|
| 中文主标题 | 思源宋体 / 霞鹜文楷 | 人文衬线，编辑感 |
| 中文小标题/正文 | 思源黑体 | 清晰可读 |
| 英文 | Inter / IBM Plex Sans | 与中文搭配协调 |

**视觉权重原则**：
- 主标题占画面视觉权重 ≥40%
- 标题不能小到「不读不知道」——它就是封面的主视觉

## IP 角色规范

### 角色定位
中性气质、25-35 岁视觉感的卡通人物。**3D 玩具感**——介于手办与插画之间，类似 designer vinyl figure 的质感。比纯 2D 插画更有体积感，但比写实 3D 更亲和。

### 角色必须有的元素

| 元素 | 描述 |
|---|---|
| **海蓝色毛衣 / 卫衣** | 角色外观主色，呼应品牌色板 |
| **眼镜** | 细框，增加「读得多」的专业感 |
| **肩膀上的卡通青椒** | IP 核心标识。拟人化（有面部表情、眼睛），小但可见。可有不同表情：好奇 / 惊讶 / 困惑 / 兴致勃勃，根据文章调性 |

### 角色与场景的关系
角色不是"摆 pose"——必须与画面里的物/事件**有互动**：
- ✅ 角色和青椒一起盯着 ThinkPad 屏幕
- ✅ 青椒指着温度计读数
- ✅ 角色把 295B 标牌放进服务器架
- ❌ 角色站在抽象背景前微笑（这是 stock 照片，不是封面）

### 不能有的元素（角色启用时）

- ❌ 渔夫帽
- ❌ 萌系动物耳/尾
- ❌ 程序员 stereotype（格子衫、连帽衫 with logos）
- ❌ stereotypical「科技感」装饰（VR 眼镜、机械臂、未来感盔甲）

### 何时启用角色（重要）

**默认不启用**。仅在以下情况：
- 用户明确要求
- 用户的署名长文（第一人称视角）
- 不在常规资讯/简报封面里默认放角色

## 场景物的具体度

画面必须有**一个具体的、可命名的物体**作为视觉焦点。

| ✅ 合格 | ❌ 不合格 |
|---|---|
| 一台 ThinkPad、一张超市价签 | 抽象的「数据流」 |
| 一根温度计、一本书 | 发光的脑子 |
| 一只手把标牌放进货架 | 几何渐变背景 |
| 一段终端代码、一份合同 | 「未来感的概念」 |

## 工艺质感关键词（必须出现在 prompt 中）

```
FLAT ILLUSTRATION, ink and watercolor style
classic editorial magazine illustration aesthetic
matte finish, paper texture, designed-not-rendered
hand-drawn linework, visible brush strokes or pen marks
limited color palette with intentional whitespace
NO photorealism, NO CGI, NO cinematic rendering, NO 3D realism
NO glossy plastic finish, NO chrome, NO photographic depth-of-field

(when character involved)
designer vinyl figure quality — stylized 3D, NOT realistic 3D
```

**关键认识**：GPT-Image-2 的默认渲染方向是 cinematic/photorealistic。要让它出 editorial illustration 必须**用否定句式强压**——光说「illustration」它会理解为「cinematic illustration」。必须显式 NO photorealism / NO CGI / NO cinematic。

**禁止在 prompt 中出现真实出版物/艺术家名称**——即使作为「参考风格」也会触发 OpenAI 安全审核（任何真实杂志、报纸、艺术家、品牌名都算）。请用形容性描述替代，如："classic editorial magazine style"、"ink illustration on textured paper"、"printed magazine cover aesthetic"。

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

每一条都对应一个被烂用过 1 万次的 AI 出图视觉模板。

## 长宽比 / 尺寸

| 用途 | 宽高比 | 推荐分辨率 | 成本/张 |
|---|---|---|---|
| **微信公众号首图（默认）** | **47:20** ≈ 2.35:1 | **1920×816** + quality=low | ~¥0.02 |
| 微信公众号首图（高清版手动）| 47:20 | 2400×1024 + quality=medium | ~¥0.24 |
| 朋友圈 / 方图缩略 | 1:1 | 1024×1024（可后期裁剪）| - |
| 视频号封面 | 3:4 | 1080×1440（如未来扩展）| - |

**默认选 1920×816 + low** 的原因：editorial illustration 风格对像素细节不敏感，简化反而更像「手绘编辑插画」、AI 痕迹更弱。需要更精细渲染时手动传 `--size 2400x1024 --quality medium`。

公众号首图比例（47:20）不可变。其他比例不在 GPT-Image-2 prompt 里出现。

**API 硬约束**：GPT-Image-2 要求 width 和 height 都能被 16 整除。1920×816 与精确 47:20 差 0.12%，2400×1024 差 0.27%，肉眼均不可见。

## 调性映射（内容类型 → 视觉调性）

| 内容类型 | 光线 | 构图 | 强调色用法 |
|---|---|---|---|
| 产品发布 | dramatic side light | 主体居中 | 用在新产品本身 |
| 行业观察 | soft natural | 黄金分割左 | 用在对比物上 |
| 技术深度 | cool clinical | 黄金分割右 | 用在数据/数字上 |
| 人物动态 | golden hour | 主体居中 | 用在人物服饰 |
| 我的署名长文 | warm natural | 灵活 | 自由 |

如果不确定，默认走「行业观察」组合。
