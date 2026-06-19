# 贡献指南

欢迎贡献。这个项目最有价值的两类贡献是：**新的风格预设**和**设计哲学的打磨**。

## 项目结构（先理解两层设计）

设计分两层，改之前先想清楚你动的是哪一层：

| 层 | 文件 | 改不改 |
|---|---|---|
| **设计哲学**（通用） | `art_director.md` | 一般**不改**。它是跨品牌通用的方法论（找钩子、画布统一性、设计原则 > 具体路径）。只有在改进通用方法论时才动。 |
| **品牌配置**（每个品牌不同） | `brand_system.md` / `presets/*.md` | 风格相关的都在这里：色板、字体、IP 角色、调性映射。 |

代码：`gen_cover.mjs`（编排：语域判断 → 钩子 → 画面 → 版式 → prompt → 出图 + 中文质检）→ `lib/llm.mjs`（艺术指导 LLM）→ `render.mjs` → `lib/image_providers.mjs`（openai 文生图 / edits 参考图融合、qwen）。其余 `lib/`：`qa.mjs`（中文标题质检）、`wireframe.mjs`（版式线框）、`wechat_render.mjs`（微信排版导出）、`env.mjs`。本地 Web UI = `server.mjs` + `web/index.html`（`npm start` 启动）。

## 本地跑起来

```bash
git clone https://github.com/naplesblue/wechatcover-skill.git
cd wechatcover-skill
cp .env.example .env        # 填 OPENAI_API_KEY + DEEPSEEK_API_KEY
node gen_cover.mjs --from-text examples/sample_bear_article.md --out covers/test.png --preview
```

`--preview` 只做艺术指导、不出图、不花出图钱，适合快速验证改动。封面生成无需 `npm install`（Node ≥ 18 内置 fetch）；只有改 Web UI 的排版导出（`markdown-it` + `juice`）时才需 `npm install`。

> ⚠️ `.env` 只在进程启动时读一次。改了 `.env` 里的 key，要重启 `node server.mjs` / 重跑 `gen_cover.mjs` 才生效（Web UI 也可直接在页面「设置」里填 key，免重启）。

## 贡献一个新风格预设（最常见）

1. 复制 `brand_system.template.md` → `presets/你的风格.md`
2. 填写 brand-specific 部分：
   - **主色板**：一个 ≥50% 主导背景色 + 精确签名色 + 单一点睛色（≤5%）。保留这个比例结构，它是「温和」气质的来源。
   - **字体规范**、**IP 角色规范**（不用角色就写明「无 IP」）、**调性映射**
3. **保留通用部分别动**：工艺质感关键词、视觉黑名单、长宽比（这些是对抗 GPT-Image-2 默认渲染 + 公众号尺寸的通用约束）
4. 出 2-3 张样图自测：
   ```bash
   node gen_cover.mjs --from-text examples/sample_bear_article.md \
     --out examples/style-你的风格.png --brand-system presets/你的风格.md
   ```
5. 自检（对照 `art_director.md` 末尾的工作流自检清单）：
   - 暖底/主导色是否 ≥50%，签名色是否克制、没主导画面
   - 是否有飞地（floating island）/ 死区（forgotten corner）
   - 中文标题是否渲染正确、是否 6-10 字
   - 有没有 AI 视觉俗套（电路板、发光脑子、镜面塑料……）
   - **没有真实品牌名 / 商标 / 出版物名**（会触发 OpenAI 安全审核）
6. 在 `README.md` 的 Showcase 加一节（样图 + 一行说明 + 切换命令）

> 放进 `presets/` 的预设会被 Web UI **自动扫描**进风格下拉（刷新页面即出现），无需改 `server.mjs` / `web/index.html`。下拉显示名取自该文件首行 `# 品牌视觉系统（…）` 括号内的文字。

## 改设计哲学（`art_director.md`）

门槛更高——它影响所有品牌。提 PR 时请附：
- 改动解决的具体问题（最好有 before/after 样图）
- 为什么停在「原则层」而不是写成「good patterns 清单」（参考「设计原则 > 具体路径」）

## 几条硬规则

- ❌ **不要把真实公司名 / 商标 / 出版物 / 艺术家名写进 prompt 或文档示例**——会触发安全审核或渲染真 logo（商标风险）。用 generic 描述。
- ❌ 不要降级到其他图像 API；失败就报错让用户决定。
- ✅ 中文标题**单次渲染**（不做 base + overlay 双层）。
- ✅ 改 `.mjs` 后跑 `node --check <file>` 确认语法。

## 提 PR

- 一个 PR 聚焦一件事（一个新预设 / 一处哲学改进 / 一个 bug 修复）
- 标题简明，描述说清「为什么」
- 涉及视觉的改动附样图

有想法但不确定要不要做？先开个 issue 聊。
