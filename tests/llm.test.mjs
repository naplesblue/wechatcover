/**
 * llm 答案提取测试 — node --test tests/llm.test.mjs
 *
 * fixture 取自真实响应：deepseek-v4-flash（V4-Flash-0731 快照）在 thinking 模式下
 * 把完整答案整段放进 reasoning_content，content 恒为空、finish_reason=stop。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickAnswer, safeParseJSON } from '../lib/llm.mjs';

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

// ── safeParseJSON：reasoning_content 回落后拿到的往往是「思考散文 + JSON」混合体 ──

test('前导中文思考 + JSON → 能提取出 JSON', () => {
  const raw = '我先分析这篇文章的钩子。用户要三个候选。\n\n好，输出：\n{"candidates":[{"hook":"钩子","image_prompt":"SUBJECT: ..."}]}';
  const p = safeParseJSON(raw);
  assert.ok(p, '应能解析');
  assert.equal(p.candidates[0].hook, '钩子');
});

test('前导思考 + fence 包裹的 JSON → 能提取', () => {
  const p = safeParseJSON('让我想想构图。\n```json\n{"a":1}\n```');
  assert.ok(p);
  assert.equal(p.a, 1);
});

test('JSON 后还拖着尾部散文 → 能提取', () => {
  const p = safeParseJSON('{"a":1}\n\n以上就是我的方案，希望符合要求。');
  assert.ok(p);
  assert.equal(p.a, 1);
});

test('思考文本里先出现无关花括号，再给完整 JSON → 提取到真正的 JSON', () => {
  const raw = '布局用 {L-T..L-B} 这种坐标。最终输出：\n{"layout":{"title":{"zone":"L-T..L-B"}},"hook":"x"}';
  const p = safeParseJSON(raw);
  assert.ok(p, '应能解析');
  assert.equal(p.hook, 'x');
});

test('纯思考、没有任何 JSON → null，不抛', () => {
  assert.equal(safeParseJSON('这篇文章讲工程化，我认为钩子应该是数字反差。'), null);
});

// fixture 取自 2026-08-11 真实响应：模型在字符串值里写了未转义的英文双引号
test('字符串值内的未转义引号 → 能修复解析', () => {
  const raw = '{\n  "candidates": [\n    {\n      "register": "信息",\n      "design_intent": "用一只工具台面上"2000字→200字"的巨型对比，让人一眼感到"我之前全在浪费时间"的痛感。",\n      "hook": "2000字prompt缩到200字，效果反而更好"\n    }\n  ]\n}';
  const p = safeParseJSON(raw);
  assert.ok(p, '应能解析');
  assert.equal(p.candidates[0].hook, '2000字prompt缩到200字，效果反而更好');
  assert.ok(p.candidates[0].design_intent.includes('2000字→200字'), '内层引号包的内容应保留');
});

test('不回归：纯 JSON / 截断 JSON 仍照常解析', () => {
  assert.equal(safeParseJSON('{"a":1}').a, 1);
  assert.equal(safeParseJSON('{"a":1,').a, 1, '截断修复仍有效');
  assert.equal(safeParseJSON('```json\n{"a":1}\n```').a, 1, 'fence 剥离仍有效');
});
