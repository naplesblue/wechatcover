/**
 * qa.mjs — 中文标题渲染质检
 *
 * 出图后用 OpenAI 视觉模型校验封面里的中文主标题是否渲染正确
 * （GPT-Image-2 偶发糊字/错字/缺字）。
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
export async function verifyTitle(imagePath, expectedTitle) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: true, skipped: true, error: '无 OPENAI_API_KEY' };
  if (!expectedTitle) return { ok: true, skipped: true, error: '无 title_text' };

  let dataUri;
  try {
    const buf = fs.readFileSync(imagePath);
    dataUri = `data:image/png;base64,${buf.toString('base64')}`;
  } catch (e) {
    return { ok: true, skipped: true, error: `读图失败: ${e.message}` };
  }

  const sys = '你是公众号封面图的质检员，只判断中文主标题有没有「渲染事故」。';
  const userText = `这张封面的期望主标题是：「${expectedTitle}」。
只看图中最大的主标题文字，先把它原样读出来（found_text），再判断 ok。

判定从宽——**只有出现真正的渲染事故才算不通过（ok=false）**：
- 糊字 / 字形扭曲、笔画粘连或断裂、无法辨认
- 错字（渲染成了另一个字）、缺字（少了字）
- 多出来的乱码字符 / 重复字 / 拼贴出的非汉字符号

**以下一律算通过（ok=true），不要因此判不通过**：
- 空格、标点、换行、字间距、对齐方式的差异
- 字体、粗细、颜色、大小的差异
- found_text 与期望只在空格/标点上不同，但汉字与字符内容一致

忽略副标题和画面里的其它文字。
只返回 JSON：{"ok": true 或 false, "found_text": "图中实际看到的主标题", "issues": "若 ok=false 简述是哪种渲染事故"}`;

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
        max_tokens: 300,
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
    if (!parsed || typeof parsed.found_text !== 'string') {
      return { ok: true, skipped: true, error: 'QA 返回无法解析' };
    }
    // 比较交给代码：模型负责 OCR，归一化后字符内容一致即通过（模型的 ok 字段不可靠，仅参考 issues）
    const found = parsed.found_text;
    const match = norm(found) === norm(expectedTitle);
    return {
      ok: match,
      foundText: found,
      issues: match ? '' : (parsed.issues || `渲染标题与期望不一致（看到「${found}」）`),
    };
  } catch (e) {
    return { ok: true, skipped: true, error: `QA 调用失败: ${e.message}` };
  }
}
