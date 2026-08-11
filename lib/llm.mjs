#!/usr/bin/env node
/**
 * llm.mjs — 共享 LLM 客户端
 *
 * 统一的 LLM 调用接口，支持 DeepSeek 和 DashScope（Qwen）。
 * 按 model 名自动路由 provider。出错（429/5xx）会重试，内容拒绝/400 直接抛错。
 *
 * 导出：
 *   callLLM(system, user, maxTokens, model, opts) — 统一调用入口
 *   safeParseJSON(raw) — 容错 JSON 解析（失败返回 null，不抛）
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

// ── 取最终答案（安全网）──
// deepseek-v4-flash 在 max_tokens 不够时会降级：整段答案憋进 reasoning_content、content 留空
// （finish_reason=stop，reasoning_tokens == completion_tokens）。真正的解法是给够预算（见 gen_cover.mjs
// maxTokens 注释），这里只保证拿得到内容——把「未返回内容」的硬失败降级成调用方可重试的软失败。
// content 有内容时一律以 content 为准，只有 content 空白才回落 —— 行为正常的模型不受影响。
export function pickAnswer(message) {
  const content = typeof message?.content === 'string' ? message.content : '';
  if (content.trim()) return content;
  return typeof message?.reasoning_content === 'string' ? message.reasoning_content : '';
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
        const content = pickAnswer(choice?.message);
        if (choice?.finish_reason === 'content_filter') {
          throw new Error(`内容被过滤 (finish_reason=content_filter, model=${model})`);
        }
        if (content && !String(choice?.message?.content || '').trim()) {
          console.error(`[WARN] ${model} 把答案憋在了 reasoning_content（content 为空，多半是 max_tokens=${maxTokens} 不够），已回落取用`);
        }
        if (choice?.finish_reason === 'length') {
          console.error(`[WARN] ${model} 输出被 max_tokens=${maxTokens} 截断，结果可能不完整`);
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
// 失败返回 null（不抛），调用方可重试；勿在此 throw，否则 gen_cover 的版式重出逻辑进不去。

// 修复字符串值内的未转义引号（模型爱写 "……"2000字→200字"的对比…"）。
// 判据：字符串内遇到 "，看下一个非空白字符——是结构符（, } ] :）就当闭合引号，
// 否则当内层引号转义。合法 JSON 里闭合引号后必然紧跟结构符，所以对合法输入是恒等变换。
function escapeInnerQuotes(s) {
  let out = '', inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr && c === '\\') { out += c + (s[i + 1] ?? ''); i++; continue; }
    if (c !== '"') { out += c; continue; }
    if (!inStr) { inStr = true; out += c; continue; }
    let k = i + 1;
    while (k < s.length && /\s/.test(s[k])) k++;
    const nxt = s[k];
    if (k >= s.length || nxt === ',' || nxt === '}' || nxt === ']' || nxt === ':') { inStr = false; out += c; }
    else out += '\\"';
  }
  return out;
}

// 对单个候选串跑修复链：截断/尾逗号/值内换行/内层引号/未闭合引号括号/注释
function tryParseRepaired(input) {
  let s = input.trim();
  if (!s) return null;
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
  // 修复字符串值内的未转义引号
  try { return JSON.parse(escapeInnerQuotes(s)); } catch {}
  try { return JSON.parse(escapeInnerQuotes(fixed)); } catch {}
  // 修复未闭合引号和括号
  let s3 = fixed;
  const quoteCount = (s3.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) s3 += '"';
  const opens = (s3.match(/[{[]/g) || []).length;
  const closes = (s3.match(/[}\]]/g) || []).length;
  for (let i = 0; i < opens - closes; i++) s3 += s3.includes('[') && !s3.endsWith('}') ? ']' : '}';
  try { return JSON.parse(s3); } catch {}
  // 补全括号后可能暴露新的尾逗号（截断恰好停在逗号后）
  try { return JSON.parse(s3.replace(/,\s*([}\]])/g, '$1')); } catch {}
  // 移除 JS 风格注释
  let s4 = s.replace(/\/\/[^\n]*/g, '');
  try { return JSON.parse(s4); } catch {
    return null;
  }
}

export function safeParseJSON(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  let s = raw;
  // 剥离 markdown fence（含出现在文中任意位置的，思考散文里常这样包答案）
  s = s.replace(/```json\s*/gi, '').replace(/```/g, '');
  // 剥离 <think> 块
  s = s.replace(/<think>[\s\S]*?<\/think>/g, '');
  s = s.trim();
  if (!s) return null;
  const direct = tryParseRepaired(s);
  if (direct !== null) return direct;
  // 整串失败 → 答案可能混在思考散文里（pickAnswer 回落 reasoning_content 的场景）。
  // 从每个 {/[ 起点向后取子串重试：真正的 JSON 起点能解析成功，散文里的杂括号
  //（如坐标 {L-T..L-B}）会连带吞掉后文而失败，天然被跳过。限次防长文退化。
  let tried = 0;
  for (let i = s.indexOf('{'); ; ) {
    const j = s.indexOf('['), starts = [i, j].filter((x) => x >= 0);
    if (!starts.length || tried >= 12) return null;
    const at = Math.min(...starts);
    const v = tryParseRepaired(s.slice(at));
    if (v !== null && typeof v === 'object') return v;
    tried++;
    s = s.slice(at + 1);
    i = s.indexOf('{');
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
