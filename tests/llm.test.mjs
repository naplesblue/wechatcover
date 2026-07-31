/**
 * llm 答案提取测试 — node --test tests/llm.test.mjs
 *
 * fixture 取自真实响应：deepseek-v4-flash（V4-Flash-0731 快照）在 thinking 模式下
 * 把完整答案整段放进 reasoning_content，content 恒为空、finish_reason=stop。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickAnswer } from '../lib/llm.mjs';

test('content 有内容时一律以 content 为准', () => {
  const msg = { content: '{"a":1}', reasoning_content: '我先想想……' };
  assert.equal(pickAnswer(msg), '{"a":1}');
});

test('content 为空 + reasoning_content 有答案 → 回落取 reasoning_content', () => {
  const answer = '{\n  "register": "信息",\n  "image_prompt": "SUBJECT: ..."\n}';
  assert.equal(pickAnswer({ content: '', reasoning_content: answer }), answer);
});

test('content 全是空白 → 同样回落', () => {
  assert.equal(pickAnswer({ content: '  \n ', reasoning_content: 'X' }), 'X');
});

test('两者都空 / 字段缺失 → 返回空串，不抛', () => {
  assert.equal(pickAnswer({ content: '', reasoning_content: '' }), '');
  assert.equal(pickAnswer({}), '');
  assert.equal(pickAnswer(undefined), '');
  assert.equal(pickAnswer({ content: null, reasoning_content: null }), '');
});
