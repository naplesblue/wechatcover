/**
 * qa.mjs — 中文标题渲染质检
 *
 * 出图后用 OpenAI 视觉模型校验封面里的中文主标题是否渲染正确
 * （GPT-Image-2 / Seedream 偶发糊字/错字/缺字）。
 *
 * 盲读：**不把期望标题告诉模型**。实测把期望标题写进提示词时，模型会照着期望
 * 「读」出一个干净的标题（「烧掉35%额度」里 % 糊成一团、度字残缺，连判 3 次都放行）。
 * 模型只负责逐字抄写 + 标出字形不规范的字；通过与否由代码判：抄写一致 且 无坏字。
 *
 * 设计原则：QA 是「加固」，绝不能阻断主流程——任何调用失败/无 key/解析失败
 * 都返回 { ok: true, skipped: true }，让封面照常产出。
 *
 * 环境变量：
 *   OPENAI_API_KEY  —— 复用出图的 key
 *   QA_MODEL        —— 视觉模型，默认 gpt-4o-mini（可按需覆盖）
 */
import './env.mjs';
import fs from 'node:fs';
import { safeParseJSON } from './llm.mjs';

const QA_MODEL = process.env.QA_MODEL || 'gpt-4o-mini';

// 归一化比较：去掉空格/常见标点、小写化，保留汉字/字母/数字/%（% 属于数字钩子，不能忽略）
function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[\s　]/g, '')
    .replace(/[，。、；：！？·…—\-_,.;:!?'"“”‘’()（）\[\]【】「」]/g, '');
}

// 返回 { ok, foundText?, issues?, skipped?, error? }
// opts.apiKey：调用方（如 web server）页面填的 key，优先于 .env
export async function verifyTitle(imagePath, expectedTitle, opts = {}) {
  const key = opts.apiKey || process.env.OPENAI_API_KEY;
  if (!key) return { ok: true, skipped: true, error: '无 OPENAI_API_KEY' };
  if (!expectedTitle) return { ok: true, skipped: true, error: '无 title_text' };

  let dataUri;
  try {
    const buf = fs.readFileSync(imagePath);
    dataUri = `data:image/png;base64,${buf.toString('base64')}`;
  } catch (e) {
    return { ok: true, skipped: true, error: `读图失败: ${e.message}` };
  }

  const sys = '你是公众号封面图的质检员，只看中文主标题的字形有没有「渲染事故」。';
  const userText = `把图中最大的主标题文字逐字抄写下来（transcript）。
严格按图上实际的字形抄写，不要根据语义去猜、补全或纠正：字被画错了就抄成它看起来的样子，认不出的字写 □。

然后逐个检查主标题里的字符，列出字形不规范的（bad_chars）：
- 糊字、像被涂抹、笔画粘连成团或断裂残缺
- 写错成别的字 / 不存在的字 / 拼贴出的非汉字符号
- 数字或 % 等符号变形、和相邻字粘在一起

字体、粗细、颜色、大小、字间距、换行、对齐都不算问题。忽略副标题和画面里的其它文字。
只返回 JSON：{"transcript": "主标题", "bad_chars": [{"c": "有问题的字", "note": "简述问题"}]}（全部正常则 bad_chars 为 []）`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: QA_MODEL,
        messages: [
          { role: 'system', content: sys },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: dataUri, detail: 'high' } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: true, skipped: true, error: `QA API ${res.status}: ${t.slice(0, 120)}` };
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || '';
    const parsed = safeParseJSON(content);
    if (!parsed || typeof parsed.transcript !== 'string') {
      return { ok: true, skipped: true, error: 'QA 返回无法解析' };
    }
    // 判定交给代码：抄写与期望一致（归一化后）且没有被标出的坏字
    const found = parsed.transcript;
    const bad = Array.isArray(parsed.bad_chars) ? parsed.bad_chars.filter((x) => x && x.c) : [];
    const match = norm(found) === norm(expectedTitle);
    const issues = [];
    if (!match) issues.push(`抄写与期望不一致（看到「${found}」）`);
    if (bad.length) issues.push(`字形不规范：${bad.map((x) => `${x.c}${x.note ? `(${x.note})` : ''}`).join('；')}`);
    return { ok: match && !bad.length, foundText: found, issues: issues.join('；') };
  } catch (e) {
    return { ok: true, skipped: true, error: `QA 调用失败: ${e.message}` };
  }
}
