/**
 * env.mjs — 从仓库根的 .env 加载环境变量（side-effect import）。
 *
 * 用法：在脚本顶部 `import './lib/env.mjs'`（或 `import './env.mjs'`），
 * 加载后即可读取 process.env.OPENAI_API_KEY / DEEPSEEK_API_KEY 等。
 * 只在变量未设置时写入，不覆盖已有的 process.env。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const envFile = path.join(ROOT, '.env');

if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}
