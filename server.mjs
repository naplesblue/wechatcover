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
const PRESETS = new Set(['default', 'cold-industrial', 'warm-orange', 'dark-editorial', 'academic']);

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
  if (!PRESETS.has(preset) || preset === 'default') return path.join(ROOT, 'brand_system.md');
  return path.join(ROOT, 'presets', `${preset}.md`);
}

// 跑 gen_cover.mjs，返回生成的图片绝对路径数组
// env: 页面填的 key/模型 env 注入（覆盖 .env；仅传 spawn 的 env，不进命令行，不落日志）
function runGenCover({ mdFile, preset, withCharacter, subtitle, variants, outBase, provider, artModel, env, previewOnly }) {
  return new Promise((resolve, reject) => {
    const a = ['gen_cover.mjs', '--from-text', mdFile, '--out', outBase, '--brand-system', brandSystemPath(preset), '--force'];
    if (withCharacter) a.push('--with-character');
    if (typeof subtitle === 'string') a.push('--subtitle', subtitle);
    if (variants > 1) a.push('--variants', String(variants));
    if (provider) a.push('--provider', provider);
    if (artModel) a.push('--model', artModel);
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
function runRender({ promptFile, outBase, provider, env }) {
  return new Promise((resolve, reject) => {
    const a = ['render.mjs', '--prompt-file', promptFile, '--out', outBase, '--size', '1920x816', '--quality', 'low'];
    if (provider) a.push('--provider', provider);
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
      const ts = Date.now();
      const mdFile = path.join(WEB_DIR, `${ts}.md`);
      fs.writeFileSync(mdFile, markdown, 'utf-8');
      const outBase = path.join(WEB_DIR, `${ts}.png`);
      const v = Math.max(1, Math.min(4, parseInt(variants, 10) || 1));
      const paths = await runGenCover({ mdFile, preset, withCharacter: !!withCharacter, subtitle, variants: v, outBase, provider, artModel, env, previewOnly });

      // 只出提示词：paths 是 meta 文件路径，读出 prompt 返回（不出图）
      if (previewOnly) {
        const prompts = paths.map((mp) => {
          let m = {};
          try { m = JSON.parse(fs.readFileSync(mp, 'utf-8')); } catch {}
          return { hook: m.hook || '', visual_concept: m.visual_concept || '', title_text: m.title_text || '', subtitle_text: m.subtitle_text || '', image_prompt: m.image_prompt || '' };
        });
        return sendJson(res, 200, { prompts });
      }

      const covers = paths.map((p) => {
        const base = path.basename(p);
        let meta = {};
        try { meta = JSON.parse(fs.readFileSync(p.replace(/\.png$/i, '.meta.json'), 'utf-8')); } catch {}
        return { url: `/cover?f=${encodeURIComponent(base)}`, file: base, hook: meta.hook || '', visual_concept: meta.visual_concept || '', title_text: meta.title_text || '', image_prompt: meta.image_prompt || '' };
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
      const ts = Date.now();
      const promptFile = path.join(WEB_DIR, `${ts}.prompt.txt`);
      fs.writeFileSync(promptFile, prompt, 'utf-8');
      const outBase = path.join(WEB_DIR, `${ts}.png`);
      const p = await runRender({ promptFile, outBase, provider, env });
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
