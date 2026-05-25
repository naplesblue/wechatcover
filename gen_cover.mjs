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
const withCharacter = args.includes('--with-character');
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
  ? `\n9. **必须**在 image_prompt 的 SUBJECT 段后追加 CHARACTER 段（参考 art_director.md「角色启用条款」与 brand_system.md「IP 角色规范」），让 IP 角色与画面互动`
  : '';

const subtitleNote = finalSubtitle
  ? `subtitle_text 已由调用方指定为 "${finalSubtitle}"，不要改写`
  : `subtitle_text 已由调用方指定为空，image_prompt 的 TEXT IN IMAGE 段不要渲染任何角落小字`;

// 单个候选的字段 schema（单候选 / 多候选共用）
const candidateSchema = `{
  "register": "Step 0 语域判断：信息 | 情绪",
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

关键要求：
1. **先做 Step 0**：判断 register（信息 / 情绪）与 design_intent，后面手法服从它——信息类才追数字钩；情绪类走氛围意象、克制，**不要硬塞数字或大字直给**
2. 钩子与画面按 register 选手法（信息类=具体物体+可猜主题；情绪类=暗示情绪、可抽象、忌写实直述）
3. 必须先按 Step 2.5 给出 layout：先想视觉层级再从 playbook 选 pattern，标注各元素落格、留白格、密度；标题区与焦点不抢同一格。image_prompt 的 COMPOSITION 段由 layout 翻译而来，体现 CANVAS UNITY（无飞地、无死区）
4. image_prompt 的 STYLE 段照搬 brand_system 的「技法与质感」（按风格，不要默认 ink/水彩）；色板段显式列 hex + 占比
5. image_prompt 的 NEGATIVE = 通用 AI 俗套黑名单 + 禁真品牌 logo + brand_system 的「风格专属 anti-slop」（照搬）
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

const maxTokens = Math.max(6000, 4500 * variants);
const LAYOUT_MAX_RETRIES = 2;            // 版式坐标硬错最多重出次数
const requiredFields = ['hook', 'visual_concept', 'title_text', 'image_prompt', 'layout'];
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

  // 必填字段缺失 = 结构性问题，直接 fatal（不重试）
  for (const [i, c] of candidates.entries()) {
    for (const f of requiredFields) {
      if (!c[f]) {
        console.error(`[FATAL] 候选 ${i + 1} 缺字段: ${f}`);
        console.error(JSON.stringify(c, null, 2));
        process.exit(1);
      }
    }
    if (typeof c.subtitle_text !== 'string') c.subtitle_text = finalSubtitle;
    if (c.image_prompt.length < 1500) console.error(`[WARN] 候选 ${i + 1} image_prompt 仅 ${c.image_prompt.length} 字符，可能不完整`);
  }

  // 版式坐标兜底：有硬错就带着具体错误重出
  const errsPerCand = candidates.map(layoutErrors);
  const bad = errsPerCand.map((e, i) => (e.length ? i : -1)).filter((i) => i >= 0);
  if (bad.length === 0) break;  // 全部通过
  const detail = bad.map((i) => `候选 ${i + 1}（${errsPerCand[i].join('；')}）`).join('，');
  if (attempt >= LAYOUT_MAX_RETRIES) {
    console.error(`[WARN] 版式坐标仍有硬错（已重出 ${LAYOUT_MAX_RETRIES} 次），保留当前结果继续：${detail}`);
    break;  // 优雅降级，不阻断
  }
  console.error(`[LAYOUT] 版式坐标硬错，重出（${attempt + 1}/${LAYOUT_MAX_RETRIES}）：${detail}`);
  layoutFix = `\n\n【重要修正】上次 layout 含非法坐标（${detail}）。坐标只能是 列 L/C/R 与 行 T/M/B 的组合（单格如 C-M，区间如 L-T..R-B）；底部整行 = L-B..R-B，顶部整行 = L-T..R-T。请重新输出全部候选，确保每个 zone 和 focal_point 都是合法坐标。`;
}

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
  const renderOnce = () => execSync(
    `node ${path.join(ROOT, 'render.mjs')} --prompt-file ${tmpPromptFile} --out ${outPath} --size ${size} --quality ${quality}${providerArg}`,
    { stdio: ['inherit', 'ignore', 'inherit'], cwd: ROOT },
  );

  console.error(`[INFO] 出图 (size=${size}, quality=${quality}) → ${outPath}`);
  try {
    renderOnce();
  } catch (e) {
    console.error(`[FATAL] render.mjs 失败（候选 ${i + 1}）: ${e.message}`);
    process.exit(1);
  }

  // 情绪语域的封面不渲染标题（纯氛围图），没有标题可校验 → 跳过 QA
  const moodNoText = /情绪|情感|氛围|mood|emotion/i.test(c.register || '');
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
