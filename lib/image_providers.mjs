/**
 * image_providers.mjs — 多后端出图抽象
 *
 * 每个 provider: async ({ prompt, size, quality, n, model, refImages }) => Buffer[]（PNG/图片字节）。
 * render.mjs 负责把 Buffer 写文件。各 provider 在函数内读自己的 env key。
 *   refImages: [{ buffer, name }]（可选）—— IP 角色参考图，让角色自然融合进画面。
 *              openai 走 edits 端点，ark 走同端点的 image 参数；qwen 不支持。
 *
 *   openai —— GPT-Image-2，同步返回 b64（需 OpenAI key / 外卡）
 *   qwen   —— 通义千问 Qwen-Image（DashScope，默认 qwen-image-2.0-pro 快照），同步，
 *             国内可支付宝充值，中文文字渲染强（封面最吃这个）
 *   ark    —— 火山引擎豆包 Seedream（默认 doubao-seedream-5.0-lite），同步，国内，
 *             中文标题渲染实测三家最强；支持参考图融合。有最小像素门槛，见 toArkSize
 *
 * 切换：--provider <name>，或 IMAGE_PROVIDER 环境变量（默认 openai）。
 */
import './env.mjs';

// ── OpenAI GPT-Image ──
function b64ToBuffers(images, where) {
  if (!images.length) throw new Error(`OpenAI ${where} 未返回图片`);
  return images.map((im) => {
    if (!im.b64_json) throw new Error(`OpenAI ${where} 返回无 b64_json 字段`);
    return Buffer.from(im.b64_json, 'base64');
  });
}

async function openaiGenerate({ prompt, size, quality, n, model, refImages }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('缺少 OPENAI_API_KEY（GPT-Image 出图需要）');
  const mdl = model || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';

  // 有参考图 → edits 端点（multipart），IP 角色自然融合进画面（实测 gpt-image-2 支持 1920×816）
  if (refImages && refImages.length) {
    const fd = new FormData();
    fd.append('model', mdl);
    fd.append('prompt', prompt);
    fd.append('size', size);
    fd.append('quality', quality);
    fd.append('n', String(n || 1));
    for (const r of refImages) {
      fd.append('image[]', new Blob([r.buffer], { type: 'image/png' }), r.name || 'ref.png');
    }
    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
    });
    if (!res.ok) throw new Error(`OpenAI edits ${res.status}: ${(await res.text()).slice(0, 400)}`);
    return b64ToBuffers((await res.json()).data || [], 'edits');
  }

  // 无参考图 → generations 端点（文生图）
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: mdl, prompt, n: n || 1, size, quality }),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return b64ToBuffers((await res.json()).data || [], 'generations');
}

// ── 通义千问 Qwen-Image（DashScope，同步）──
// 尺寸用「宽*高」星号格式。Qwen-Image 主要支持若干预设比例（最宽约 16:9）；
// 公众号 47:20 若被拒或想换尺寸，用 QWEN_IMAGE_SIZE 覆盖。
function toQwenSize(size) {
  return (process.env.QWEN_IMAGE_SIZE || size).replace(/x/i, '*');
}
async function qwenGenerate({ prompt, size, n }) {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error('缺少 DASHSCOPE_API_KEY（Qwen 文生图需要）');
  const base = process.env.DASHSCOPE_ENDPOINT || 'https://dashscope.aliyuncs.com';
  const model = process.env.QWEN_IMAGE_MODEL || 'qwen-image-2.0-pro-2026-04-22';

  const res = await fetch(`${base}/api/v1/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
      parameters: { size: toQwenSize(size), watermark: false, prompt_extend: false },
    }),
  });
  if (!res.ok) throw new Error(`Qwen 文生图 ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();

  // 同步返回，图片 URL 在 output.choices[].message.content[].image（24h 过期，须下载）
  const urls = [];
  for (const ch of data.output?.choices || []) {
    for (const c of ch.message?.content || []) if (c.image) urls.push(c.image);
  }
  if (!urls.length) throw new Error(`Qwen 未返回图片 URL: ${JSON.stringify(data.output || data).slice(0, 300)}`);

  const buffers = [];
  for (const u of urls.slice(0, n || 1)) {
    const ir = await fetch(u);
    if (!ir.ok) throw new Error(`下载 Qwen 图片失败 ${ir.status}`);
    buffers.push(Buffer.from(await ir.arrayBuffer()));
  }
  return buffers;
}

// ── 火山引擎 Ark / 豆包 Seedream（同步）──
// 端点从 ARK_ENDPOINT 推导（去掉 /chat/completions 换成 /images/generations），
// 因为 ark- 前缀的订阅 key 只认 /api/plan/v3 通道，标准 /api/v3 对它返回 401。
function arkImageUrl() {
  if (process.env.ARK_IMAGE_ENDPOINT) return process.env.ARK_IMAGE_ENDPOINT;
  const base = (process.env.ARK_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions')
    .trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  return `${base}/images/generations`;
}

// Seedream 有最小像素门槛（5.0-lite 要求 ≥3,686,400），封面默认的 1920×816 会被拒。
// 按原比例等比放大到达标，长宽各取 16 的倍数（对齐图像模型的常见块大小）。
const ARK_MIN_PIXELS = 3686400;
export function toArkSize(size) {
  if (process.env.ARK_IMAGE_SIZE) return process.env.ARK_IMAGE_SIZE;
  const m = /^(\d+)\s*[x*]\s*(\d+)$/i.exec(String(size || '').trim());
  if (!m) return '3008x1280';
  let [w, h] = [Number(m[1]), Number(m[2])];
  if (w * h < ARK_MIN_PIXELS) {
    const k = Math.sqrt(ARK_MIN_PIXELS / (w * h));
    const round16 = (v) => Math.ceil((v * k) / 16) * 16;
    [w, h] = [round16(w), round16(h)];
    while (w * h < ARK_MIN_PIXELS) { w += 16; h = Math.round((h * w) / (w - 16) / 16) * 16; }
  }
  return `${w}x${h}`;
}

async function arkGenerate({ prompt, size, n, model, refImages }) {
  const key = process.env.ARK_API_KEY;
  if (!key) throw new Error('缺少 ARK_API_KEY（火山引擎 Seedream 出图需要）');
  const mdl = model || process.env.ARK_IMAGE_MODEL || 'doubao-seedream-5.0-lite';

  const body = { model: mdl, prompt, size: toArkSize(size), response_format: 'b64_json', watermark: false };
  // 参考图：单张传字符串，多张传数组（data URL），走同一端点做融合编辑
  if (refImages && refImages.length) {
    const urls = refImages.map((r) => `data:image/png;base64,${r.buffer.toString('base64')}`);
    body.image = urls.length === 1 ? urls[0] : urls;
  }

  const res = await fetch(arkImageUrl(), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Ark 生图 ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();
  const items = (data.data || []).slice(0, n || 1);
  if (!items.length) throw new Error(`Ark 未返回图片: ${JSON.stringify(data).slice(0, 300)}`);

  const buffers = [];
  for (const it of items) {
    if (it.b64_json) { buffers.push(Buffer.from(it.b64_json, 'base64')); continue; }
    if (!it.url) throw new Error(`Ark 返回项无图片字段: ${JSON.stringify(it).slice(0, 200)}`);
    const ir = await fetch(it.url);          // url 形式 24h 过期，须立即下载
    if (!ir.ok) throw new Error(`下载 Ark 图片失败 ${ir.status}`);
    buffers.push(Buffer.from(await ir.arrayBuffer()));
  }
  return buffers;
}

const PROVIDERS = { openai: openaiGenerate, qwen: qwenGenerate, ark: arkGenerate };

export function listProviders() { return Object.keys(PROVIDERS); }

export async function generate(provider, opts) {
  const fn = PROVIDERS[provider];
  if (!fn) throw new Error(`未知 provider: ${provider}（可选: ${Object.keys(PROVIDERS).join(', ')}）`);
  return fn(opts);
}
