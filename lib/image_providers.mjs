/**
 * image_providers.mjs — 多后端出图抽象
 *
 * 每个 provider: async ({ prompt, size, quality, n, model }) => Buffer[]（PNG/图片字节）。
 * render.mjs 负责把 Buffer 写文件。各 provider 在函数内读自己的 env key。
 *
 *   openai —— GPT-Image-2，同步返回 b64（需 OpenAI key / 外卡）
 *   qwen   —— 通义千问 Qwen-Image（DashScope，默认 qwen-image-2.0-pro 快照），同步，
 *             国内可支付宝充值，中文文字渲染强（封面最吃这个）
 *
 * 切换：--provider <name>，或 IMAGE_PROVIDER 环境变量（默认 openai）。
 */
import './env.mjs';

// ── OpenAI GPT-Image ──
async function openaiGenerate({ prompt, size, quality, n, model }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('缺少 OPENAI_API_KEY（GPT-Image 出图需要）');
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2', prompt, n: n || 1, size, quality }),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const images = (await res.json()).data || [];
  if (!images.length) throw new Error('OpenAI 未返回图片');
  return images.map((im) => {
    if (!im.b64_json) throw new Error('OpenAI 返回无 b64_json 字段');
    return Buffer.from(im.b64_json, 'base64');
  });
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

const PROVIDERS = { openai: openaiGenerate, qwen: qwenGenerate };

export function listProviders() { return Object.keys(PROVIDERS); }

export async function generate(provider, opts) {
  const fn = PROVIDERS[provider];
  if (!fn) throw new Error(`未知 provider: ${provider}（可选: ${Object.keys(PROVIDERS).join(', ')}）`);
  return fn(opts);
}
