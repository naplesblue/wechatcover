# 品牌视觉系统（模板）

> Fork 工作流：复制本文件为 `brand_system.md`，把下面 `{{...}}` 占位换成你自己的品牌。
> 一份填好的实例见 `brand_system.example.md`（暖纸蓝 + 青椒 IP）。
>
> 哪些要改 / 哪些别动：
> - **要改**：色板、字体、IP 角色、调性映射（这些定义「你的品牌长什么样」）
> - **别动**：工艺质感关键词、视觉黑名单、长宽比（这些是对抗 GPT-Image-2 默认渲染 + 公众号尺寸的通用约束，对所有品牌都成立）
> - 设计哲学（找钩子 / 画布统一性 / 设计原则 > 具体路径）在 `art_director.md`，通用，一般不用改。

## 主色板（按优先级使用）

一句话设计哲学：**{{用一句话概括你的视觉气质，例如「温和的锋利」「冷静的工业感」}}**。
描述「整张图读起来应该像什么」：{{例如「暖纸上的蓝色插画」}}。

| 角色 | 颜色 | Hex | 用法 | 画面占比 |
|---|---|---|---|---|
| **主导背景** | {{底色名}} | `{{#hex}}` | 整体底色，阅读感的来源 | **≥50%** |
| **品牌签名色** | {{签名色名}} | `{{#hex}}` | 仅用在关键标识：主标题、主体轮廓、焦点物 | 15-25% |
| 辅助 | {{辅助色名}} | `{{#hex}}` | 阴影、次要文字、支撑元素 | 10-15% |
| 强调 | {{强调色名}} | `{{#hex}}` | 最重要的数字/文字（≤2 处） | 5-10% |
| 点睛 | {{点睛色名}} | `{{#hex}}` | 唯一点睛色，一处点亮 | ≤5% |

**关键约束**（按你的品牌改写，但保留「主导色 ≥50% + 签名色精确点缀」的结构）：
- {{签名色}}不要主导画面——它是品牌调性，不是音量
- {{主导色}}质感是用户观感第一位的来源

**禁止颜色**（建议保留）：
- ❌ 纯黑 `#000000`、纯白 `#FFFFFF`（缺乏温度）
- ❌ 高饱和荧光色
- ❌ 多色彩虹渐变
- ❌ 多个强调色并列（点睛色只能一个）

## 字体规范

| 用途 | 字体 | 备注 |
|---|---|---|
| 中文主标题 | {{衬线字体，如 思源宋体 / 霞鹜文楷}} | 编辑感 |
| 中文小标题/正文 | {{黑体，如 思源黑体}} | 清晰可读 |
| 英文 | {{如 Inter / IBM Plex Sans}} | 与中文搭配协调 |

**视觉权重原则**（建议保留）：
- 主标题占画面视觉权重 ≥40%
- 标题不能小到「不读不知道」

## IP 角色规范

> 不用 IP 角色的品牌可整段删掉。用的话分两种写法：
>
> - **纯文字（`--with-character`）**：没有参考图，靠文字定长相 → 下面填**完整**的角色元素表（外形/配饰/标识都写清楚）。多次生成长相只能大致一致。
> - **参考图（`--ip-image`，推荐）**：有角色参考图 → **不要硬规定外形**，改成「参考图驱动的轻描述」：只给**最小身份**（如「一只辣椒吉祥物」）防纯文本 LLM 瞎编 + 一条「别画成人」的护栏，外形 100% 交给参考图（实例见仓库 `local`/`private` 思路）。硬写外观反而会和参考图打架。
>
> ⚠️ **拼装约定**：工具在「不带 IP」时会按 `## IP 角色规范` 这个小标题，把整节从提示词里移除。
> 所以 IP 形象只写在这一节里——**别在别处（顶部说明、场景物示例、调性映射等）写死你的 IP/吉祥物名字**，
> 否则不带 IP 时也会泄漏进画面。

### 角色定位
{{一句话定位，如「中性气质、3D 玩具感卡通人物」}}

### 角色必须有的元素

| 元素 | 描述 |
|---|---|
| {{标志服饰}} | {{呼应品牌色}} |
| {{标志配件}} | {{如眼镜}} |
| {{IP 核心标识}} | {{如肩上的卡通形象，拟人化、有表情}} |

### 角色与场景的关系
角色不是"摆 pose"——必须与画面里的物/事件**有互动**（盯着、指着、拿着、检查）。

### 不能有的元素（角色启用时）
- ❌ {{要避免的形象元素，如某个已被别人用的标志}}
- ❌ 程序员/科技 stereotype（格子衫、VR 眼镜、机械臂等）

### 何时启用角色
**默认不启用**。仅在用户明确要求 / 署名长文时启用。不在常规资讯封面里默认放角色（会消耗稀缺性）。

## 场景物的具体度

画面必须有**一个具体的、可命名的物体**作为视觉焦点。

| ✅ 合格 | ❌ 不合格 |
|---|---|
| 一台具体设备、一张具体单据 | 抽象的「数据流」 |
| 一根温度计、一本书 | 发光的脑子 |
| 一只手把标牌放进货架 | 几何渐变背景 |

## 工艺质感关键词（通用，建议原样保留 — 必须出现在 prompt 中）

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

**关键认识**：GPT-Image-2 默认渲染方向是 cinematic/photorealistic。要让它出 editorial illustration 必须**用否定句式强压**——光说「illustration」它会理解为「cinematic illustration」。

**禁止在 prompt 中出现真实出版物/艺术家名称**——即使作为「参考风格」也会触发 OpenAI 安全审核（任何真实杂志、报纸、艺术家、品牌名都算）。请用形容性描述替代，如："classic editorial magazine style"、"ink illustration on textured paper"。

## 视觉黑名单（通用，建议原样保留 — 必须在 prompt 的 NEGATIVE 部分显式列出）

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

## 长宽比 / 尺寸（通用，建议原样保留）

| 用途 | 宽高比 | 推荐分辨率 | 成本/张 |
|---|---|---|---|
| **微信公众号首图（默认）** | **47:20** ≈ 2.35:1 | **1920×816** + quality=low | ~¥0.02 |
| 微信公众号首图（高清版手动）| 47:20 | 2400×1024 + quality=medium | ~¥0.24 |

**默认选 1920×816 + low**：editorial illustration 风格对像素细节不敏感，简化反而 AI 痕迹更弱。

**API 硬约束**：GPT-Image-2 要求 width 和 height 都能被 16 整除。1920×816 与精确 47:20 差 0.12%，肉眼不可见。

## 调性映射（内容类型 → 视觉调性）

| 内容类型 | 光线 | 构图 | 强调色用法 |
|---|---|---|---|
| 产品发布 | {{如 dramatic side light}} | 主体居中 | 用在新产品本身 |
| 行业观察 | {{如 soft natural}} | 黄金分割左 | 用在对比物上 |
| 技术深度 | {{如 cool clinical}} | 黄金分割右 | 用在数据/数字上 |
| 人物动态 | {{如 golden hour}} | 主体居中 | 用在人物服饰 |
| 署名长文 | {{如 warm natural}} | 灵活 | 自由 |

如果不确定，默认走「行业观察」组合。
