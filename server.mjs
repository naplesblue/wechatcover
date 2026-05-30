#!/usr/bin/env node
/**
 * server.mjs — 本地 Web UI（零依赖，Node 原生 http）
 *
 * 粘贴文章 → 出封面（预览 / 再来一张 / 下载）+ 顺手导出微信排版 HTML。
 * 解决 Bear → 手工导出 .md → 命令行 的繁琐。
 *
 * 用法：
 *   node server.mjs          # 默认 http://localhost:8787
 *   PORT=9000 node server.mjs
 *
 * 后端复用 gen_cover.mjs（出封面）和 lib/wechat_render.mjs（排版导出）。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import './lib/env.mjs';  // 加载 .env 到 process.env（供 /keys-status 判断 .env 里有没有 key）
// 注意：排版导出用的 lib/wechat_render.mjs 依赖 markdown-it + juice，
// 这里**懒加载**——这样封面那条路（gen_cover，零依赖）即使没 npm install 也能用，
// 只有点「导出微信排版 HTML」才需要依赖。

const ROOT = import.meta.dirname;
const PORT = parseInt(process.env.PORT || '8787', 10);
const WEB_DIR = path.join(ROOT, 'covers', '_web');
// 风格预设动态扫盘：同时列 presets/（公开，入库）+ private/（私有，gitignored）
// 文件名安全约束：只允许 [a-zA-Z0-9_-]，避免路径越界
const PRESET_DIRS = ['presets', 'private'];
function safePresetName(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name);
}
function presetLabel(name) {
  if (name === 'default') return '暖纸蓝（默认）';
  for (const dir of PRESET_DIRS) {
    try {
      const text = fs.readFileSync(path.join(ROOT, dir, `${name}.md`), 'utf-8');
      // 取 "# 品牌视觉系统（...）" 括号内文字，去掉「风格预设：」前缀
      const m = text.match(/^#\s+品牌视觉系统[（(]([^）)]+)[）)]/m);
      if (m) return m[1].trim().replace(/^(风格)?预设[：:]\s*/, '');
    } catch {}
  }
  return name;
}
function listPresets() {
  const names = new Set(['default']);
  for (const dir of PRESET_DIRS) {
    try {
      for (const f of fs.readdirSync(path.join(ROOT, dir))) {
        if (f.endsWith('.md')) {
          const name = f.slice(0, -3);
          if (safePresetName(name)) names.add(name);
        }
      }
    } catch {}
  }
  // default 第一，其余按名字字母序
  const arr = [...names].filter((n) => n !== 'default').sort();
  return [{ name: 'default', label: presetLabel('default') }, ...arr.map((n) => ({ name: n, label: presetLabel(n) }))];
}

fs.mkdirSync(WEB_DIR, { recursive: true });

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}
function sendJson(res, status, obj) {
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > 5e6) reject(new Error('body 过大')); else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function brandSystemPath(preset) {
  if (!preset || preset === 'default' || !safePresetName(preset)) return path.join(ROOT, 'brand_system.md');
  for (const dir of PRESET_DIRS) {
    const p = path.join(ROOT, dir, `${preset}.md`);
    if (fs.existsSync(p)) return p;
  }
  return path.join(ROOT, 'brand_system.md');  // 找不到时退回默认
}

// IP 角色参考图：约定放在 private/ip/。扫到图片才让前端显示角色开关（开源用户没这目录 → 开关隐藏）。
const IP_DIR = path.join(ROOT, 'private', 'ip');
const IP_IMG_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(png|jpe?g|webp)$/i;
function listIpImages() {
  try {
    return fs.readdirSync(IP_DIR).filter((f) => IP_IMG_RE.test(f)).sort();
  } catch { return []; }
}
// 把前端传来的文件名安全解析为 private/ip 下的绝对路径（必须在扫描列表里，防越界）
function resolveIpImage(name) {
  if (!name || !IP_IMG_RE.test(name)) return null;
  if (!listIpImages().includes(name)) return null;
  return path.join(IP_DIR, name);
}

// 跑 gen_cover.mjs，返回生成的图片绝对路径数组
// env: 页面填的 key/模型 env 注入（覆盖 .env；仅传 spawn 的 env，不进命令行，不落日志）
function runGenCover({ mdFile, preset, withCharacter, subtitle, variants, outBase, provider, artModel, env, previewOnly, diverseLayouts, essay, ipImagePath }) {
  return new Promise((resolve, reject) => {
    const a = ['gen_cover.mjs', '--from-text', mdFile, '--out', outBase, '--brand-system', brandSystemPath(preset), '--force'];
    if (ipImagePath) a.push('--ip-image', ipImagePath);  // 参考图融合（隐含开启角色）
    else if (withCharacter) a.push('--with-character');
    if (typeof subtitle === 'string') a.push('--subtitle', subtitle);
    if (variants > 1) a.push('--variants', String(variants));
    if (provider) a.push('--provider', provider);
    if (artModel) a.push('--model', artModel);
    if (diverseLayouts) a.push('--diverse-layouts');  // 多方案时各候选尽量用不同版式
    if (essay) a.push('--essay');                      // 感悟模式：强制 register=感悟，无文字纯意象
    if (previewOnly) a.push('--preview');  // 只出提示词、不调生图
    const ps = spawn('node', a, { cwd: ROOT, env: { ...process.env, ...(env || {}) } });
    let out = '', err = '';
    ps.stdout.on('data', (d) => { out += d; });
    ps.stderr.on('data', (d) => { err += d; process.stderr.write(d); });
    ps.on('close', (code) => {
      if (code !== 0) return reject(new Error(err.trim().split('\n').slice(-3).join(' ') || `gen_cover 退出码 ${code}`));
      const paths = out.trim().split('\n').filter(Boolean);
      resolve(paths);
    });
    ps.on('error', reject);
  });
}

// 跑 render.mjs（同提示词重出，不重跑艺术指导）→ 返回新图片绝对路径
function runRender({ promptFile, outBase, provider, env, ipImagePath }) {
  return new Promise((resolve, reject) => {
    const a = ['render.mjs', '--prompt-file', promptFile, '--out', outBase, '--size', '1920x816', '--quality', 'low'];
    if (provider) a.push('--provider', provider);
    if (ipImagePath) a.push('--ip-image', ipImagePath);  // 「按此构图出图」也带上参考图，延续 IP 画风
    const ps = spawn('node', a, { cwd: ROOT, env: { ...process.env, ...(env || {}) } });
    let out = '', err = '';
    ps.stdout.on('data', (d) => { out += d; });
    ps.stderr.on('data', (d) => { err += d; process.stderr.write(d); });
    ps.on('close', (code) => {
      if (code !== 0) return reject(new Error(err.trim().split('\n').slice(-3).join(' ') || `render 退出码 ${code}`));
      const p = out.trim().split('\n').filter(Boolean).pop();
      if (!p) return reject(new Error('render 未返回图片路径'));
      resolve(p);
    });
    ps.on('error', reject);
  });
}

// 从请求体取页面填的 key/模型 → spawn env（非空才注入，覆盖 .env）
function envFromBody(body, provider) {
  const env = {};
  for (const k of ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'DASHSCOPE_API_KEY']) {
    const v = body.keys?.[k];
    if (typeof v === 'string' && v.trim()) env[k] = v.trim();
  }
  if (typeof body.imageModel === 'string' && body.imageModel.trim()) {
    env[provider === 'qwen' ? 'QWEN_IMAGE_MODEL' : 'OPENAI_IMAGE_MODEL'] = body.imageModel.trim();
  }
  return env;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === 'GET' && url.pathname === '/') {
      const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'));
      return send(res, 200, 'text/html; charset=utf-8', html);
    }

    // 风格预设列表（动态扫盘：presets/ 公开 + private/ 私有合并；前端用它生成下拉）
    if (req.method === 'GET' && url.pathname === '/presets') {
      return sendJson(res, 200, { presets: listPresets() });
    }

    // IP 角色参考图列表（扫 private/ip/）；前端据此决定显不显示角色开关。空 = 没这目录/没图。
    if (req.method === 'GET' && url.pathname === '/ip-images') {
      return sendJson(res, 200, { images: listIpImages() });
    }

    // key 是否就绪（只回布尔，绝不回 key 值）——页面据此判断 .env 里有没有
    if (req.method === 'GET' && url.pathname === '/keys-status') {
      return sendJson(res, 200, {
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
        DASHSCOPE_API_KEY: !!process.env.DASHSCOPE_API_KEY,
      });
    }

    // 提供生成的封面图（仅限 covers/_web 下，按 basename，防穿越）
    if (req.method === 'GET' && url.pathname === '/cover') {
      const f = path.basename(url.searchParams.get('f') || '');
      const p = path.join(WEB_DIR, f);
      if (!f.endsWith('.png') || !fs.existsSync(p)) return send(res, 404, 'text/plain', 'not found');
      return send(res, 200, 'image/png', fs.readFileSync(p));
    }

    if (req.method === 'POST' && url.pathname === '/generate') {
      const body = JSON.parse(await readBody(req));
      const { markdown, preset = 'default', withCharacter = false, subtitle = '', variants = 1 } = body;
      if (!markdown || !markdown.trim()) return sendJson(res, 400, { error: '请粘贴文章内容' });
      const provider = ['openai', 'qwen'].includes(body.provider) ? body.provider : 'openai';
      const artModel = (typeof body.model === 'string' && body.model.trim()) ? body.model.trim() : null;
      const env = envFromBody(body, provider);  // 页面填的 key/模型 → env（非空才注入，覆盖 .env）
      const previewOnly = !!body.previewOnly;
      // IP 角色参考图：前端传文件名，安全解析为 private/ip 下路径（仅 openai 支持 edits）
      const ipImagePath = (body.withCharacter && provider === 'openai') ? resolveIpImage(body.ipImage) : null;
      const ts = Date.now();
      const mdFile = path.join(WEB_DIR, `${ts}.md`);
      fs.writeFileSync(mdFile, markdown, 'utf-8');
      const outBase = path.join(WEB_DIR, `${ts}.png`);
      const v = Math.max(1, Math.min(4, parseInt(variants, 10) || 1));
      const paths = await runGenCover({ mdFile, preset, withCharacter: !!withCharacter, subtitle, variants: v, outBase, provider, artModel, env, previewOnly, diverseLayouts: !!body.diverseLayouts, essay: !!body.essay, ipImagePath });

      // 只出提示词：paths 是 meta 文件路径，读出 prompt 返回（不出图）
      if (previewOnly) {
        const prompts = paths.map((mp) => {
          let m = {};
          try { m = JSON.parse(fs.readFileSync(mp, 'utf-8')); } catch {}
          return { register: m.register || '', design_intent: m.design_intent || '', hook: m.hook || '', visual_concept: m.visual_concept || '', title_text: m.title_text || '', subtitle_text: m.subtitle_text || '', image_prompt: m.image_prompt || '', layout: m.layout || null };
        });
        return sendJson(res, 200, { prompts });
      }

      const covers = paths.map((p) => {
        const base = path.basename(p);
        let meta = {};
        try { meta = JSON.parse(fs.readFileSync(p.replace(/\.png$/i, '.meta.json'), 'utf-8')); } catch {}
        return { url: `/cover?f=${encodeURIComponent(base)}`, file: base, register: meta.register || '', design_intent: meta.design_intent || '', hook: meta.hook || '', visual_concept: meta.visual_concept || '', title_text: meta.title_text || '', image_prompt: meta.image_prompt || '' };
      });
      return sendJson(res, 200, { covers });
    }

    // 同提示词重出：直接用给定 image_prompt 出图，不重跑艺术指导
    if (req.method === 'POST' && url.pathname === '/render') {
      const body = JSON.parse(await readBody(req));
      const prompt = typeof body.image_prompt === 'string' ? body.image_prompt.trim() : '';
      if (prompt.length < 50) return sendJson(res, 400, { error: '提示词为空或过短' });
      const provider = ['openai', 'qwen'].includes(body.provider) ? body.provider : 'openai';
      const env = envFromBody(body, provider);
      const ipImagePath = provider === 'openai' ? resolveIpImage(body.ipImage) : null;
      const ts = Date.now();
      const promptFile = path.join(WEB_DIR, `${ts}.prompt.txt`);
      fs.writeFileSync(promptFile, prompt, 'utf-8');
      const outBase = path.join(WEB_DIR, `${ts}.png`);
      const p = await runRender({ promptFile, outBase, provider, env, ipImagePath });
      const base = path.basename(p);
      return sendJson(res, 200, { url: `/cover?f=${encodeURIComponent(base)}`, file: base });
    }

    if (req.method === 'POST' && url.pathname === '/wechat') {
      const { markdown } = JSON.parse(await readBody(req));
      if (!markdown || !markdown.trim()) return sendJson(res, 400, { error: '请粘贴文章内容' });
      let renderWechatHtml;
      try {
        ({ renderWechatHtml } = await import('./lib/wechat_render.mjs'));
      } catch {
        return sendJson(res, 500, { error: '排版导出需要先安装依赖：在项目目录运行 npm install' });
      }
      return sendJson(res, 200, { html: renderWechatHtml(markdown) });
    }

    send(res, 404, 'text/plain', 'not found');
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.error(`[wechatcover] Web UI: http://localhost:${PORT}`);
});
