#!/usr/bin/env node
/**
 * gen_cover.mjs — 公众号封面图生成
 *
 * 流程：
 *   1. 读 --from-text 指定的 markdown 文章（提取标题 + 正文摘要）
 *   2. 加载 brand_system.md + art_director.md
 *   3. 调 LLM（默认 deepseek-v4-flash，thinking + effort=high）按艺术指导三步法 → JSON
 *   4. 把 image_prompt 喂给 render.mjs（GPT-Image-2）
 *   5. 保存到 --out + 同名 .meta.json
 *
 * 用法：
 *   node gen_cover.mjs --from-text article.md --out cover.png
 *     [--subtitle "yourdomain.com · 2026.05.21"]  # 默认空（无角落小字）
 *     [--with-character]                           # 默认关（不带 IP 角色）
 *     [--ip-image a.png,b.png]                     # IP 角色参考图（逗号分隔），走 edits 自然融合；隐含开启角色，仅 openai
 *     [--brand-system path/to/brand_system.md]     # 默认 ./brand_system.md
 *     [--quality low|medium|high]                  # 默认 low（~¥0.02/张）
 *     [--size 1920x816|2400x1024]                  # 默认 1920x816
 *     [--preview]                                  # 只做艺术指导，打印 JSON，不出图
 *     [--wireframe]                                # 出图前先生成 HTML 版式线框图确认构图，不出图
 *     [--force]                                    # 覆盖已存在输出
 *     [--model deepseek-v4-flash]                  # 艺术指导模型（也可 GEN_COVER_MODEL 环境变量）
 *     [--effort low|high|max]                      # 推理强度，默认 high（仅 deepseek 生效）
 *     [--variants N]                               # 一次出 N 个不同钩子/构图候选（默认 1）
 *                                                  # N>1 时输出 {out}-1.png … {out}-N.png
 *     [--diverse-layouts]                          # N>1 时让各候选尽量用不同版式 pattern（默认按内容自动选）
 *     [--no-qa]                                    # 关闭中文标题渲染质检（默认开）
 *     [--qa-retries N]                             # 糊字时自动重出次数，默认 1
 *     [--provider openai|qwen]                     # 出图后端，默认 openai（也可 IMAGE_PROVIDER）
 *                                                  #   qwen=通义千问 Qwen-Image，需 DASHSCOPE_API_KEY
 *
 * 环境变量（.env）：
 *   DEEPSEEK_API_KEY  —— 艺术指导（默认模型 deepseek-v4-flash）
 *   DASHSCOPE_API_KEY —— 艺术指导（--model qwen-* 时）
 *   GEN_COVER_MODEL   —— 默认艺术指导模型（可被 --model 覆盖）
 *   OPENAI_API_KEY    —— GPT-Image-2 出图（render.mjs 内部用）
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import './lib/env.mjs';
import { callLLM, safeParseJSON } from './lib/llm.mjs';
import { verifyTitle } from './lib/qa.mjs';
import { renderWireframe } from './lib/wireframe.mjs';

const ROOT = import.meta.dirname;

const args = process.argv.slice(2);
function arg(name, def = null) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1]?.startsWith('--') ? true : args[i + 1] ?? true) : def;
}

const preview = args.includes('--preview');
// --wireframe：做艺术指导 → 写 HTML 版式线框图（出图前确认构图），不出图
const wireframe = args.includes('--wireframe');
const force = args.includes('--force');
// 默认省钱版（~¥0.02/张）；高清版传 --size 2400x1024 --quality medium
const quality = arg('quality', 'low');
const size = arg('size', '1920x816');

const fromTextPath = arg('from-text', null);
const outOverride = arg('out', null);
// --subtitle "..." 任意覆盖，--subtitle "" 表示无 subtitle，未传 = null（走默认：空）
const subtitleOverride = args.includes('--subtitle')
  ? (args[args.indexOf('--subtitle') + 1] ?? '')
  : null;
// IP 角色参考图：--ip-image a.png,b.png（逗号分隔）。给了就走 edits 自然融合，并隐含开启角色。
const ipImage = typeof arg('ip-image') === 'string' ? arg('ip-image') : null;
const withCharacter = args.includes('--with-character') || !!ipImage;
const brandSystemPath = arg('brand-system', path.join(ROOT, 'brand_system.md'));
// 艺术指导模型：--model > GEN_COVER_MODEL 环境变量 > 默认 deepseek-v4-flash
const modelOverride = typeof arg('model') === 'string' ? arg('model') : null;
// 推理强度（仅 deepseek 生效，映射为 reasoning_effort）：--effort low|high|max，默认 high
const effort = (typeof arg('effort') === 'string' ? arg('effort') : null) || 'high';
// 多候选：--variants N，一次出 N 个不同钩子/构图的候选（默认 1）
const variants = Math.max(1, parseInt(arg('variants', '1'), 10) || 1);
// 中文标题 QA：默认开，糊字自动重出；--no-qa 关闭，--qa-retries N 调重试次数（默认 1）
const qaEnabled = !args.includes('--no-qa');
const qaRetries = (() => { const v = parseInt(arg('qa-retries', '1'), 10); return Number.isNaN(v) ? 1 : Math.max(0, v); })();
// 出图后端：--provider openai|qwen（透传给 render.mjs；不传则 render 用默认/IMAGE_PROVIDER）
const imageProvider = typeof arg('provider') === 'string' ? arg('provider') : null;
// 多方案版式多样化：仅当 variants>1 时生效，让各候选尽量用不同 pattern（默认关 = 按内容自动选最优）
const diverseLayouts = args.includes('--diverse-layouts');
// 感悟模式：手动强制 register=感悟（无文字、纯情绪意象图，适合散文/随笔/感悟）
const essayMode = args.includes('--essay');

if (!fromTextPath) {
  console.error('[ERROR] --from-text 必填');
  console.error('用法: node gen_cover.mjs --from-text article.md --out cover.png [--subtitle "..."] [--with-character]');
  process.exit(1);
}
if (!fs.existsSync(fromTextPath)) {
  console.error(`[ERROR] --from-text 文件不存在: ${fromTextPath}`);
  process.exit(1);
}

// ── 读文章，提取标题 + 正文摘要 ──
const rawText = fs.readFileSync(fromTextPath, 'utf-8').trim();
// 标题：优先第一个 # heading，否则第一行非空文本截 50 字
const headingMatch = rawText.match(/^#\s+(.+)$/m);
const titleFromText = headingMatch
  ? headingMatch[1].trim()
  : (rawText.split('\n').find(l => l.trim()) || '').slice(0, 50);
// body：去掉第一个标题行后取前 8000 字给 LLM 做艺术指导（读全文级，便于抓最强数字钩子）
const bodyFromText = rawText.replace(/^#\s+.+$/m, '').trim();
const fileSlug = path.basename(fromTextPath, path.extname(fromTextPath))
  .toLowerCase()
  .replace(/[^a-z0-9一-鿿]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60) || 'cover';

const cs = {
  title: titleFromText || fileSlug,
  body: bodyFromText.slice(0, 8000),
  sourceSlug: fileSlug,
};

// ── 输出路径：默认 ./covers/{slug}-{timestamp}.png ──
const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const OUT_PATH = outOverride || path.join(ROOT, 'covers', `${fileSlug}-${timestamp}.png`);

if (variants === 1 && fs.existsSync(OUT_PATH) && !force && !preview && !wireframe) {
  console.error(`[SKIP] 封面已存在: ${OUT_PATH}（--force 可覆盖）`);
  console.log(OUT_PATH);
  process.exit(0);
}

// 决定最终 subtitle：--subtitle 显式覆盖 > 默认空
const finalSubtitle = subtitleOverride !== null ? subtitleOverride : '';

console.error(`[INFO] 文章: ${cs.title}`);
console.error(`[INFO] 输出: ${OUT_PATH}`);
if (finalSubtitle) {
  console.error(`[INFO] subtitle: ${finalSubtitle}`);
} else {
  console.error(`[INFO] subtitle: (无，不渲染)`);
}
if (withCharacter) console.error(`[INFO] IP 角色: 启用`);

// ── 加载 skill 文档 ──
if (!fs.existsSync(brandSystemPath)) {
  console.error(`[ERROR] 找不到 brand_system: ${brandSystemPath}`);
  console.error('提示: 参照 brand_system.template.md 创建你自己的 brand_system.md');
  process.exit(1);
}
let brandSystem = fs.readFileSync(brandSystemPath, 'utf-8');
const artDirector = fs.readFileSync(path.join(ROOT, 'art_director.md'), 'utf-8');

// IP 角色规范是 brand_system 里的可插拔模块（按「## IP 角色规范」小标题切到下一个 ## 或文末）。
// 拼装逻辑：带 IP 才保留这段；不带 IP 时整段移除——上下文里压根没有 IP 描述，自然不会被画进去。全部风格通用。
if (!withCharacter) {
  brandSystem = brandSystem.replace(/\n## IP 角色规范[\s\S]*?(?=\n## |\s*$)/, '\n').trim();
}

// ── 调 LLM 做艺术指导 ──
const ART_DIRECTOR_MODEL = modelOverride || process.env.GEN_COVER_MODEL || 'deepseek-v4-flash';
const needsKey = ART_DIRECTOR_MODEL.startsWith('deepseek') ? 'DEEPSEEK_API_KEY' : 'DASHSCOPE_API_KEY';
if (!process.env[needsKey]) {
  console.error(`[ERROR] 缺少 ${needsKey}（艺术指导模型 ${ART_DIRECTOR_MODEL} 需要）`);
  process.exit(1);
}

const systemPrompt = `你是一位资深平面设计师 / 公众号封面设计顾问，熟稔 Swiss 国际主义、Bauhaus、Apple 高端极简、日系留白、高端杂志编辑等成熟设计体系。
工作方式：**先以设计师的判断力定方向（这篇该是什么气质、什么语域、靠什么取胜），再用下面的品牌系统与框架细则收口**——做设计，不是套模板。
严格遵循下面的品牌视觉系统（技法、色板、anti-slop 都以它为准）和艺术指导框架。

# 品牌视觉系统

${brandSystem}

---

# 艺术指导框架

${artDirector}`;

const subtitleJsonLine = finalSubtitle
  ? `  "subtitle_text": "${finalSubtitle}",`
  : `  "subtitle_text": "",`;

// 带 IP 才追加 CHARACTER 指令；不带 IP 时 brand_system 的 IP 段已被移除，无需任何说明
const characterExtra = withCharacter
  ? `\n9. **必须**在 image_prompt 的 SUBJECT 段后追加 CHARACTER 段（参考 art_director.md「角色启用条款」与 brand_system.md「IP 角色规范」），让 IP 角色与画面互动${ipImage ? `\n   ⚠️ 本次会把 IP 角色**参考图**一并喂给图像模型（edits 融合）。**参考图是角色长相的唯一依据**：CHARACTER 段只写"the mascot shown in the reference image"，用 brand_system 给的**最小身份**点明它本质是什么（如 a chili-pepper mascot），然后**只描述它的动作 / 表情 / 互动**。\n   **硬禁**：CHARACTER 段不得出现任何参考图里没有的外观词——不要写衣服 / 帽子 / 贝雷帽 / 马甲 / 围巾 / 配饰 / 五官等任何外形描述（"keep the reference's exact look, do not add anything not in the reference"）。外形 100% 交给参考图，文字只管它"在做什么、什么情绪"。更不要把它画成人。
   **颜色唯一例外**：若 brand_system 的「钦定配色」给了固定颜色句，CHARACTER 段**必须原样包含**那句；除这句外仍禁止出现任何其他颜色词。没有钦定配色时颜色也一律不写。` : ''}`
  : '';

const subtitleNote = finalSubtitle
  ? `subtitle_text 已由调用方指定为 "${finalSubtitle}"，不要改写`
  : `subtitle_text 已由调用方指定为空，image_prompt 的 TEXT IN IMAGE 段不要渲染任何角落小字`;

// 单个候选的字段 schema（单候选 / 多候选共用）
const candidateSchema = `{
  "register": "Step 0 语域判断：信息 | 情绪 | 感悟",
  "design_intent": "Step 0 一句话设计意图（这张靠什么取胜）",
  "hook": "Step 1 的产出（≤20 字）",
  "visual_concept": "Step 2 的产出（≤80 字，中文描述）",
  "title_text": "封面显示的主标题（中文 6-10 字，是 hook 的视觉化版本）",
${subtitleJsonLine}
  "layout": {
    "pattern": "Step 2.5 的版式名（左字右图 / 右字左图 / 字压图 / 上图下字 / 上字下图 之一）",
    "focal_point": "视线第一落点，单格（如 C-M）",
    "title": { "zone": "标题占区（如 L-T..L-B）", "align": "left|center|right", "weight": "dominant|secondary" },
    "elements": [ { "what": "具名物体", "zone": "落区（如 C-T..C-B）", "role": "focal|support" } ],
    "accent": { "what": "点睛色落点", "zone": "单格" },
    "negative_space": "留白格（如 R-T）",
    "density": "low|medium|high",
    "reading_flow": "视线路径（如 L→C→R）"
  },
  "image_prompt": "完整的英文 image prompt（按 art_director.md 模板填充，COMPOSITION 段由 layout 翻译而来，包含 SUBJECT / STYLE / LIGHTING / COMPOSITION / COLOR PALETTE / TEXT IN IMAGE / NEGATIVE 等段，长度 ~3500-5500 字符）"
}`;

const outputSpec = variants === 1
  ? `输出严格的 JSON（单个对象）：\n\n${candidateSchema}`
  : `输出严格的 JSON，包含 ${variants} 个**角度互不相同**的候选，格式：\n\n{\n  "candidates": [\n${candidateSchema},\n    ...（共 ${variants} 个）\n  ]\n}`;

const variantsNote = variants === 1
  ? ''
  : `\n10. ${variants} 个候选必须是**真正不同的创意角度**（不同钩子、或同钩子下不同视觉切入），不要只是措辞微调${diverseLayouts ? `\n11. ${variants} 个候选请尽量采用**不同的版式 pattern**（从 playbook 里选不同项：左字右图 / 右字左图 / 字压图 / 上图下字 / 上字下图），便于横向对比构图` : ''}`;

const userPrompt = `请为这篇文章设计封面：

【标题】
${cs.title}

【正文摘要】
${cs.body || ''}

按 art_director.md 的流程（Step 0 设计判断 → 找钩子 → 设计画面 → 定版式 → 写完整 prompt），${outputSpec}
${essayMode ? '\n**⚠️ 用户已手动选定 register = 感悟**：跳过 Step 0 的自动语域判断，直接按 **感悟** 语域走——`hook` 字段填 3-5 个情绪关键词（非钩子非数字）；画面是**自由意象、与文章具体物件解绑**的纯氛围图；**无文字**。\n' : ''}
关键要求：
1. **先做 Step 0**：判断 register（信息 / 情绪）与 design_intent，后面手法服从它——信息类才追数字钩；情绪类走氛围意象、克制，**不要硬塞数字或大字直给**
2. 钩子与画面按 register 选手法（信息类=具体物体+可猜主题；情绪类=暗示情绪、可抽象、忌写实直述）
3. 必须先按 Step 2.5 给出 layout：先想视觉层级再从 playbook 选 pattern，标注各元素落格、留白格、密度；标题区与焦点不抢同一格。image_prompt 的 COMPOSITION 段由 layout 翻译而来，体现 CANVAS UNITY（无飞地、无死区）
4. image_prompt 的 STYLE 段照搬 brand_system 的「技法与质感」（按风格，不要默认 ink/水彩）；色板段显式列 hex + 占比
5. image_prompt 的 NEGATIVE = 通用 AI 俗套黑名单 + 禁真品牌 logo + **禁编造数据**（图上的数字/比例/版本号只能用文章真有的，没真数就用非数字的"数据感"，不要凭空造 92%/8x 之类）+ brand_system 的「风格专属 anti-slop」（照搬）
6. title_text 始终输出（作文章标题用）；但**情绪语域**时 image_prompt 的 TEXT IN IMAGE **不在图上渲染标题**（纯氛围图，标题交给文章标题），仅**信息语域**才在图上渲染大标题
7. ${subtitleNote}
8. 只输出 JSON，不要 markdown 代码块标记，不要解释${characterExtra}${variantsNote}`;

// ── 版式坐标兜底校验：只挑客观硬错（非法坐标 / 缺核心结构字段），有错就让 LLM 重出 ──
// 软问题（重叠、留白多少、pattern 选择）不管——那是设计取舍，人会自己跳过，代码不限制 LLM 思路。
const COLS = ['L', 'C', 'R'], ROWS = ['T', 'M', 'B'];
function cellValid(cell) {
  if (typeof cell !== 'string') return false;
  const [c, r] = cell.trim().split('-');
  return COLS.includes(c) && ROWS.includes(r);
}
function zoneValid(zone) {
  if (typeof zone !== 'string' || !zone.trim()) return false;
  const parts = zone.split('..').map((s) => s.trim());
  return parts.length >= 1 && parts.length <= 2 && parts.every(cellValid);
}
// 返回该候选 layout 的硬错清单（空数组 = 通过）。
// 只查「渲染核心块」的坐标——标题区 + 各具名元素：它们坐标非法会让标题/焦点直接画不出来。
// 不查 focal_point / accent / negative_space：前者只是元信息，后两者非法时只是少画一个小块（优雅降级），
// 且 negative_space="none" 对满幅「字压图」是合理表达——硬卡会白白触发重出。
function layoutErrors(c) {
  const errs = [];
  const L = c && c.layout;
  if (!L || typeof L !== 'object') { errs.push('layout 缺失或非对象'); return errs; }
  if (!L.title || !zoneValid(L.title.zone)) errs.push(`title.zone 非法坐标「${L.title && L.title.zone}」`);
  (Array.isArray(L.elements) ? L.elements : []).forEach((el, i) => {
    if (!zoneValid(el && el.zone)) errs.push(`elements[${i}].zone 非法坐标「${el && el.zone}」`);
  });
  return errs;
}

// deepseek-v4-flash 的思考预算从 max_tokens 里切：预算不够时它会降级——答案憋在
// reasoning_content 里、content 留空，或推理膨胀顶满预算后 JSON 被截断。
// 实测：6000 必挂；18000 也会被膨胀重试吃满（JSON 失败后的重试，推理会暴涨到
// 17999 token 顶格截断死）。答案本体只需 ~5K token，64000 是「宽松有界」：
// 平时用不到，膨胀时兜得住；deepseek-flash 输出便宜，别再往下调。
const maxTokens = 64000;
const LAYOUT_MAX_RETRIES = 2;            // 版式坐标 / image_prompt 缺失最多重出次数
let candidates;
let layoutFix = '';                      // 重出时追加的坐标纠正提示（仅修语法，不限创意）
for (let attempt = 0; ; attempt++) {
  console.error(`[INFO] 调用 ${ART_DIRECTOR_MODEL} 做艺术指导（thinking enabled, effort=${effort}${variants > 1 ? `, ${variants} 候选` : ''}${attempt > 0 ? `, 版式重出 ${attempt}/${LAYOUT_MAX_RETRIES}` : ''}）...`);
  let llmOutput;
  try {
    llmOutput = await callLLM(systemPrompt, userPrompt + layoutFix, maxTokens, ART_DIRECTOR_MODEL, {
      jsonMode: true,
      thinking: 'enabled',
      effort,
    });
  } catch (err) {
    console.error(`[FATAL] LLM 调用失败: ${err.message}`);
    process.exit(1);
  }
  if (!llmOutput || llmOutput.trim().length === 0) {
    console.error('[FATAL] LLM 未返回内容');
    process.exit(1);
  }

  const parsed = safeParseJSON(llmOutput);
  if (!parsed) {
    if (attempt < LAYOUT_MAX_RETRIES) { console.error('[WARN] LLM 输出非有效 JSON，重出'); layoutFix = ''; continue; }
    console.error('[FATAL] LLM 输出非有效 JSON');
    console.error(llmOutput.slice(0, 1200));
    process.exit(1);
  }

  // 归一化为候选数组
  if (variants === 1) {
    candidates = [parsed];
  } else {
    candidates = Array.isArray(parsed) ? parsed : parsed.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      if (attempt < LAYOUT_MAX_RETRIES) { console.error('[WARN] LLM 未返回 candidates 数组，重出'); layoutFix = ''; continue; }
      console.error('[FATAL] LLM 未返回 candidates 数组');
      console.error(JSON.stringify(parsed, null, 2).slice(0, 1200));
      process.exit(1);
    }
    if (candidates.length > variants) candidates = candidates.slice(0, variants);
    if (candidates.length < variants) console.error(`[WARN] 只返回了 ${candidates.length}/${variants} 个候选`);
  }

  // 软字段缺失 → 兜底填默认，不崩（title_text 在情绪/感悟语域本就不渲染，返空是正常的；
  // hook/visual_concept 只是信息字段。唯一硬需求是 image_prompt——没它没法出图）
  for (const c of candidates) {
    if (!c.title_text) c.title_text = cs.title;
    if (!c.hook) c.hook = '';
    if (!c.visual_concept) c.visual_concept = '';
    if (typeof c.subtitle_text !== 'string') c.subtitle_text = finalSubtitle;
  }

  // image_prompt 缺失/过短（多为输出截断）+ 版式坐标硬错 → 都走重试
  const promptBad = candidates.map((c, i) => (!c.image_prompt || c.image_prompt.length < 1500) ? i : -1).filter((i) => i >= 0);
  const errsPerCand = candidates.map(layoutErrors);
  const layoutBad = errsPerCand.map((e, i) => (e.length ? i : -1)).filter((i) => i >= 0);
  if (promptBad.length === 0 && layoutBad.length === 0) break;  // 全部通过

  const reasons = [];
  if (promptBad.length) reasons.push(`候选 ${promptBad.map((i) => i + 1).join('/')} 的 image_prompt 缺失或过短`);
  if (layoutBad.length) reasons.push(layoutBad.map((i) => `候选 ${i + 1}（${errsPerCand[i].join('；')}）`).join('，'));
  const detail = reasons.join('；');

  if (attempt >= LAYOUT_MAX_RETRIES) {
    if (promptBad.length) {  // image_prompt 缺是硬伤，重试用尽仍无 → 明确报错（不 dump 整段 JSON）
      console.error(`[FATAL] 重试 ${LAYOUT_MAX_RETRIES} 次后 image_prompt 仍缺失或过短（多为输出被截断）。可重试，或换更稳的艺术指导模型。`);
      process.exit(1);
    }
    console.error(`[WARN] 版式坐标仍有硬错（已重出 ${LAYOUT_MAX_RETRIES} 次），保留当前结果继续：${detail}`);
    break;  // 仅 layout 软降级，不阻断
  }
  console.error(`[RETRY] 候选有问题，重出（${attempt + 1}/${LAYOUT_MAX_RETRIES}）：${detail}`);
  layoutFix = layoutBad.length
    ? `\n\n【重要修正】上次 layout 含非法坐标（${detail}）。坐标只能是 列 L/C/R 与 行 T/M/B 的组合（单格如 C-M，区间如 L-T..R-B）；底部整行 = L-B..R-B，顶部整行 = L-T..R-T。请重新输出全部候选，确保每个 zone 和 focal_point 都是合法坐标。`
    : '';
}

// 清洗 image_prompt：把"网格脚手架"从送给图像模型的提示词里抹掉。
// layout 的 3×3 网格只是我们排版的内部表示——坐标码（L-T / R-B）会被画成文字标签，
// 「3x3 grid / grid cell」这类机制词会被画成网格构造线。图像模型只该看到"东西在画面哪个位置"
// 的空间散文。LLM 常把脚手架词漏进 prompt，故代码兜底中性化，不依赖 LLM 听话。
function sanitizeImagePrompt(prompt) {
  return prompt
    .replace(/\b[LCR]-[TMB]\s*\.\.\s*[LCR]-[TMB]\b/g, '')  // 区间码 L-T..R-B
    .replace(/\b[LCR]-[TMB]\b/g, '')                        // 单格码 C-M
    // 删掉"画一条线/边框分隔版式分区"的指令（分区边界应隐形，LLM 常materialize成实线）
    .replace(/\b(?:a |an )?(?:thin |bold |subtle )?(?:[a-z-]+ )?(?:vertical |horizontal )?(?:line|divider|border|stripe)\s+(?:that\s+)?(?:separat\w+|divid\w+|split\w*)[^.;\n]*[.;]?/gi, '')
    .replace(/\bno\s+grid\s+cells?\s+(?:is|are)\s+wasted\b/gi, 'every area is intentional')
    .replace(/\b\d\s*[x×]\s*\d\s+grid\b/gi, 'composition')  // 3x3 grid → composition
    .replace(/\b(?:thirds?|3\s*[x×]\s*3)[- ]?grid\b/gi, 'composition')
    .replace(/\bgrid\s+cells?\b/gi, 'areas')
    .replace(/\bgrid\b/gi, 'layout')                        // 残余 grid → layout
    .replace(/\b\d\s*[x×]\s*\d\b/g, '')                      // 残余 3x3
    .replace(/\(\s*(?:to|through|–|—|-|至|到|,|，)*\s*\)/gi, '')  // 空壳括号 ( to ) ( )
    .replace(/（\s*(?:至|到|,|，)*\s*）/g, '')                // 中文空壳括号
    .replace(/[ \t]*([，,；;。.])/g, '$1')                   // 标点前空格
    .replace(/([，,；;])\s*(?=[，,；;])/g, '')               // 连续标点
    .replace(/[ \t]{2,}/g, ' ')                              // 多空格
    .trim();
}
for (const c of candidates) c.image_prompt = sanitizeImagePrompt(c.image_prompt);

// 每个候选的输出路径：单候选用原名，多候选加序号后缀
function variantPath(base, i) {
  if (candidates.length === 1) return base;
  const ext = path.extname(base);
  return `${base.slice(0, -ext.length)}-${i + 1}${ext}`;
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

const results = [];
const metas = [];
const wireframes = [];
for (const [i, c] of candidates.entries()) {
  const outPath = variantPath(OUT_PATH, i);
  const metaPath = outPath.replace(/\.png$/i, '.meta.json');
  metas.push(metaPath);

  console.error(`\n[候选 ${i + 1}/${candidates.length}]`);
  console.error(`语域:      ${c.register || '—'}${c.design_intent ? ` · ${c.design_intent}` : ''}`);
  console.error(`钩子:      ${c.hook}`);
  console.error(`画面:      ${c.visual_concept}`);
  console.error(`主标题:    ${c.title_text}`);
  console.error(`副标题:    ${c.subtitle_text}`);
  console.error(`版式:      ${c.layout?.pattern || '—'} · ${c.layout?.density || '—'} · 焦点 ${c.layout?.focal_point || '—'}`);
  console.error(`prompt:    ${c.image_prompt.length} 字符`);

  fs.writeFileSync(metaPath, JSON.stringify({ ...c, sourceSlug: cs.sourceSlug }, null, 2), 'utf-8');

  if (wireframe) {
    const htmlPath = outPath.replace(/\.png$/i, '.wireframe.html');
    const promptPath = outPath.replace(/\.png$/i, '.prompt.txt');
    fs.writeFileSync(htmlPath, renderWireframe(c), 'utf-8');
    fs.writeFileSync(promptPath, c.image_prompt, 'utf-8');
    wireframes.push({ htmlPath, promptPath, outPath });
    console.error(`版式线框:  ${htmlPath}`);
    continue;
  }

  if (preview) continue;

  const tmpPromptFile = path.join('/tmp', `cover_${fileSlug}_${i + 1}_${Date.now()}.txt`);
  fs.writeFileSync(tmpPromptFile, c.image_prompt, 'utf-8');
  // stdout 设为 ignore：render.mjs 会把图片路径 console.log 到 stdout，
  // 若 inherit 会污染本脚本 stdout（最终路径输出），让调用方（如 web server）解析到重复行。
  // 只保留 render 的 stderr 进度。
  const providerArg = imageProvider ? ` --provider ${imageProvider}` : '';
  const ipArg = ipImage ? ` --ip-image ${ipImage}` : '';
  const renderOnce = () => execSync(
    `node ${path.join(ROOT, 'render.mjs')} --prompt-file ${tmpPromptFile} --out ${outPath} --size ${size} --quality ${quality}${providerArg}${ipArg}`,
    { stdio: ['inherit', 'ignore', 'inherit'], cwd: ROOT },
  );

  console.error(`[INFO] 出图 (size=${size}, quality=${quality}) → ${outPath}`);
  try {
    renderOnce();
  } catch (e) {
    console.error(`[FATAL] render.mjs 失败（候选 ${i + 1}）: ${e.message}`);
    process.exit(1);
  }

  // 情绪 / 感悟 语域的封面不渲染标题（纯氛围图），没有标题可校验 → 跳过 QA
  const moodNoText = /情绪|情感|氛围|感悟|散文|随笔|mood|emotion|essay/i.test(c.register || '');
  // 中文标题 QA + 自动重出（默认开；--no-qa 关闭；情绪图无标题时跳过）
  if (qaEnabled && !moodNoText) {
    for (let attempt = 0; ; attempt++) {
      const qa = await verifyTitle(outPath, c.title_text);
      if (qa.skipped) { console.error(`[QA] 跳过（${qa.error}）`); break; }
      if (qa.ok) { console.error(`[QA] ✓ 标题渲染正确`); break; }
      console.error(`[QA] ✗ 标题可能有问题: ${qa.issues || '—'}（看到: ${qa.foundText || '—'}）`);
      if (attempt >= qaRetries) { console.error(`[QA] 已达重试上限(${qaRetries})，保留当前图`); break; }
      console.error(`[QA] 自动重出 (${attempt + 1}/${qaRetries})...`);
      try { renderOnce(); } catch (e) { console.error(`[QA] 重出失败: ${e.message}`); break; }
    }
  }

  results.push(outPath);
}

if (wireframe) {
  console.error(`\n[WIREFRAME] 已生成 ${wireframes.length} 张版式线框图（未出图）。确认构图后，用下面命令按锁定的提示词出图：`);
  for (const w of wireframes) {
    console.error(`  node render.mjs --prompt-file ${w.promptPath} --out ${w.outPath} --size ${size} --quality ${quality}${imageProvider ? ` --provider ${imageProvider}` : ''}`);
  }
  console.log(wireframes.map((w) => w.htmlPath).join('\n'));  // 输出 html 路径供调用方/打开
  process.exit(0);
}

if (preview) {
  console.error(`\n[PREVIEW] --preview 跳过图像 API 调用（已写 ${candidates.length} 份 meta）`);
  console.log(metas.join('\n'));  // 输出 meta 路径，供调用方（web server）读取提示词
  process.exit(0);
}

console.error(`\n[OK] 生成 ${results.length} 张封面`);
console.log(results.join('\n'));
