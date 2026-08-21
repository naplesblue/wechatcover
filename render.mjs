#!/usr/bin/env node
/**
 * render.mjs — 封面图渲染薄封装（多后端）
 *
 * 用法：
 *   node render.mjs \
 *     --prompt-file /tmp/prompt.txt \
 *     --out covers/my-cover.png \
 *     [--provider openai|qwen|ark] [--size 2400x1024] [--quality medium] [--n 1]
 *     [--ip-image a.png,b.png]   # IP 角色参考图（逗号分隔多张），自然融合，openai / ark 支持
 *
 * 也可以从 stdin 读 prompt：
 *   cat prompt.txt | node render.mjs --out out.png
 *
 * 出图后端（--provider，或 IMAGE_PROVIDER 环境变量，默认 openai）：
 *   openai   — GPT-Image-2，中文文字渲染强；需 OPENAI_API_KEY（外卡）
 *   qwen     — 通义千问 Qwen-Image（qwen-image-max）；需 DASHSCOPE_API_KEY（国内可支付宝充值，中文文字渲染强）
 *   ark      — 火山引擎豆包 Seedream（doubao-seedream-5.0-lite）；需 ARK_API_KEY（国内，中文标题实测最强）
 *
 * 备注：
 *   - openai 默认 1920x816 + low（省钱版 ~¥0.02/张）；高清 --size 2400x1024 --quality medium
 *   - 比例 47:20（公众号首图标准）
 *   - qwen 主要支持预设比例（最宽约 16:9），47:20 若被拒用 QWEN_IMAGE_SIZE 覆盖；quality 对它无效
 *   - ark 有最小像素门槛（≥3,686,400），会按原比例自动放大（1920x816 → 2960x1264）；
 *     quality 对它无效；ARK_IMAGE_SIZE 可强制覆盖
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './lib/image_providers.mjs';

// 加载 .env（与脚本同级；render.mjs 可独立调用，故自带内联 loader）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}

// ── 解析参数 ──
const args = process.argv.slice(2);
function arg(name, def = null) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
}
const promptFile = arg('prompt-file');
const outPath = arg('out');
// 默认省钱版（~¥0.02/张），editorial 风格对像素细节不敏感；高清版手动传 --size 2400x1024 --quality medium
const size = arg('size', '1920x816');
const quality = arg('quality', 'low');
const n = parseInt(arg('n', '1'), 10);
// 不给默认值：模型名是 provider 专属的，硬编码某家的默认值会被透传到别家
// （曾把 gpt-image-2 传给 ark → UnsupportedModel）。各 provider 内部自带兜底。
const model = arg('model', null);
const provider = arg('provider') || process.env.IMAGE_PROVIDER || 'openai';
// IP 角色参考图：--ip-image a.png,b.png（逗号分隔）。传了就走 edits 自然融合（仅 openai）。
const ipImageArg = arg('ip-image');
const refImages = [];
if (ipImageArg) {
  for (const p of String(ipImageArg).split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!fs.existsSync(p)) { console.error(`[ERROR] --ip-image 文件不存在: ${p}`); process.exit(1); }
    refImages.push({ buffer: fs.readFileSync(p), name: path.basename(p) });
  }
}
const REF_CAPABLE = ['openai', 'ark'];   // openai 走 edits，ark 走 image 参数；qwen 不支持
if (refImages.length && !REF_CAPABLE.includes(provider)) {
  console.error(`[ERROR] --ip-image 参考图融合仅支持 --provider ${REF_CAPABLE.join(' / ')}`);
  process.exit(1);
}

if (!outPath) {
  console.error('[ERROR] --out 必填');
  console.error('用法: render.mjs --prompt-file <file> --out <path.png> [--provider openai|qwen]');
  process.exit(1);
}

// ── 读 prompt ──
let prompt = '';
if (promptFile) {
  if (!fs.existsSync(promptFile)) {
    console.error(`[ERROR] prompt 文件不存在: ${promptFile}`);
    process.exit(1);
  }
  prompt = fs.readFileSync(promptFile, 'utf-8').trim();
} else {
  // 从 stdin 读
  prompt = fs.readFileSync(0, 'utf-8').trim();
}

if (prompt.length < 50) {
  console.error(`[ERROR] prompt 太短 (${prompt.length} 字符)，请检查输入`);
  process.exit(1);
}

console.error(`[INFO] prompt 长度: ${prompt.length} 字符`);
console.error(`[INFO] provider: ${provider}, size: ${size}, quality: ${quality}${refImages.length ? `, IP参考图: ${refImages.length} 张(edits)` : ''}`);

// ── 出图（按 provider 路由）+ 写文件 ──
async function main() {
  let buffers;
  try {
    buffers = await generate(provider, { prompt, size, quality, n, model, refImages });
  } catch (e) {
    console.error(`[FATAL] ${e.message}`);
    process.exit(1);
  }
  if (!buffers || !buffers.length) {
    console.error('[FATAL] provider 未返回图片');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  if (buffers.length === 1) {
    fs.writeFileSync(outPath, buffers[0]);
    console.error(`[OK] 已保存: ${outPath}`);
    console.log(outPath);
  } else {
    const dir = path.dirname(outPath);
    const ext = path.extname(outPath);
    const stem = path.basename(outPath, ext);
    const paths = [];
    for (let i = 0; i < buffers.length; i++) {
      const p = path.join(dir, `${stem}-${i + 1}${ext}`);
      fs.writeFileSync(p, buffers[i]);
      paths.push(p);
      console.error(`[OK] 已保存: ${p}`);
    }
    console.log(paths.join('\n'));
  }
}

main();
