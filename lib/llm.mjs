#!/usr/bin/env node
/**
 * llm.mjs — 共享 LLM 客户端
 *
 * 统一的 LLM 调用接口，支持 DeepSeek 和 DashScope（Qwen）。
 * 按 model 名自动路由 provider。出错（429/5xx）会重试，内容拒绝/400 直接抛错。
 *
 * 导出：
 *   callLLM(system, user, maxTokens, model, opts) — 统一调用入口
 *   safeParseJSON(raw) — 容错 JSON 解析
 */
import './env.mjs';

// ── 环境 ──
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEEPSEEK_URL = (process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com') + '/v1/chat/completions';

const DEFAULT_MODEL = process.env.DASHSCOPE_MODEL || 'qwen-plus';

// ── 路由：根据 model 名自动选择 provider ──
function resolveProvider(model) {
  if (model.startsWith('deepseek')) return 'deepseek';
  return 'dashscope'; // qwen / 默认
}

// ── 统一 LLM 调用 ──
// opts: { jsonMode: bool, thinking: 'enabled'|'disabled', effort: 'low'|'high'|'max', temperature: number }
//   - thinking/effort 仅对 deepseek 生效；effort 映射为 DeepSeek 的 reasoning_effort 参数
export async function callLLM(system, user, maxTokens = 2000, model = DEFAULT_MODEL, opts = {}) {
  const provider = resolveProvider(model);
  const isDS = provider === 'deepseek';
  const apiUrl = isDS ? DEEPSEEK_URL : DASHSCOPE_URL;
  const apiKey = isDS ? DEEPSEEK_API_KEY : DASHSCOPE_API_KEY;
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const payload = {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: maxTokens,
      };
      if (isDS && opts.thinking === 'disabled') {
        payload.temperature = 0.1;
        payload.thinking = { type: 'disabled' };
      } else if (isDS && opts.thinking === 'enabled') {
        payload.thinking = { type: 'enabled' };
        if (opts.effort) payload.reasoning_effort = opts.effort;
      } else if (!isDS) {
        payload.temperature = opts.temperature ?? 0.3;
      }
      if (opts.jsonMode) {
        payload.response_format = { type: 'json_object' };
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        const choice = json.choices?.[0];
        const content = choice?.message?.content || '';
        if (choice?.finish_reason === 'content_filter') {
          throw new Error(`内容被过滤 (finish_reason=content_filter, model=${model})`);
        }
        return content;
      }
      if (res.status === 400) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`${provider} API 400: ${errBody.slice(0, 200)}`);
      }
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        const delay = 1000 * Math.pow(3, attempt);
        console.error(`[RETRY] ${provider} API ${res.status}, ${delay / 1000}s 后重试 (${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw new Error(`${provider} API ${res.status}`);
    } catch (e) {
      // 400 / content_filter 不重试，直接抛给调用方
      if (/API 400|content_filter/.test(e.message)) throw e;
      if (attempt >= MAX_RETRIES) throw e;
      const delay = 1000 * Math.pow(3, attempt);
      console.error(`[RETRY] 网络错误: ${e.message}, ${delay / 1000}s 后重试 (${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ── JSON 安全解析 ──
export function safeParseJSON(raw) {
  let s = raw;
  // 剥离 markdown fence
  s = s.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
  // 剥离 <think> 块
  s = s.replace(/<think>[\s\S]*?<\/think>/g, '');
  s = s.trim();
  // 截断修复：找最后一个完整的 brace
  const last = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (last > 0 && !s.endsWith('}') && !s.endsWith(']')) s = s.slice(0, last + 1);
  // 第一次尝试
  try { return JSON.parse(s); } catch {}
  // 修复尾部逗号
  let fixed = s.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(fixed); } catch {}
  // 修复值内的换行
  let s2 = fixed.replace(/(?<=: *"(?:[^"\\]|\\.)*)\n(?=[^"]*")/g, '\\n');
  try { return JSON.parse(s2); } catch {}
  // 修复未闭合引号和括号
  let s3 = fixed;
  const quoteCount = (s3.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) s3 += '"';
  const opens = (s3.match(/[{[]/g) || []).length;
  const closes = (s3.match(/[}\]]/g) || []).length;
  for (let i = 0; i < opens - closes; i++) s3 += s3.includes('[') && !s3.endsWith('}') ? ']' : '}';
  try { return JSON.parse(s3); } catch {}
  // 移除 JS 风格注释
  let s4 = s.replace(/\/\/[^\n]*/g, '');
  try { return JSON.parse(s4); } catch (e) {
    throw new SyntaxError(`JSON 解析失败: ${e.message}\n原始输出前200字: ${raw.slice(0, 200)}`);
  }
}

// ── 环境信息（供调用方 log）──
export function getLLMInfo() {
  return {
    dashscope: !!DASHSCOPE_API_KEY,
    deepseek: !!DEEPSEEK_API_KEY,
    defaultModel: DEFAULT_MODEL,
  };
}
