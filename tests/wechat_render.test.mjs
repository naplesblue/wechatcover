/**
 * wechat_render 列表渲染测试 — node --test tests/wechat_render.test.mjs
 *
 * fixture 取自真实失败样本：文章正文用字面 bullet 字符（•）+ 缩进子条目，
 * 微信预览里整块列表被挤成一段。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWechatHtml } from '../lib/wechat_render.mjs';

// 截图里的失败样本（节选，含深缩进嵌套子条目）
const literalBulletSource = `桥接器功能描述：
• 定位: 本地 MCP 桥 + 路由 skill, 不是替换当前会话模型, 而是「第二通道 / 外包通道」。
• 宿主: 已在 Claude Code 跑通; 同样可用于 OpenAI Codex 等能挂 MCP 的环境。
• 核心能力
        • 只读提问与仓库说明
        • 基于 Git 上下文的代码审查
• 安全默认
        • 写模式双闸: 环境允许 + 单次显式 write
• 前提: Node.js、已安装并登录的 Grok Build CLI、支持 MCP 的编码助手。`;

test('字面 • 列表：每个条目独立成块，不挤在同一段', () => {
  const html = renderWechatHtml(literalBulletSource);
  // 条目各自独立 —— 两个条目的文字不能出现在同一文本块里
  const textBlocks = html.split(/<[^>]+>/).filter(s => s.trim());
  for (const block of textBlocks) {
    assert.ok(!(block.includes('定位') && block.includes('宿主')),
      `「定位」「宿主」两个条目被挤进同一文本块: ${block.slice(0, 120)}`);
    assert.ok(!(block.includes('只读提问') && block.includes('代码审查')),
      `嵌套子条目被挤进同一文本块: ${block.slice(0, 120)}`);
  }
  // 每个条目渲染为独立 <section>（bullet 在灰色 span 内）
  assert.match(html, /•<\/span>\s*定位/, '「定位」应为独立 bullet section');
  assert.match(html, /•<\/span>\s*宿主/, '「宿主」应为独立 bullet section');
});

test('字面 • 深缩进子条目：不被误判为 code block，无嵌套残留碎片', () => {
  const html = renderWechatHtml(literalBulletSource);
  assert.ok(!html.includes('<pre'), '深缩进子条目被误判成 code block');
  assert.ok(!html.includes('<code'), '深缩进子条目被误判成 code block');
  assert.ok(!/<\/li>|<\/ul>|<\/ol>|<li|<ul|<ol/.test(html),
    '输出不应残留任何 ul/ol/li 标签（应全部展开为 section）');
  assert.ok(html.includes('只读提问与仓库说明'), '子条目内容丢失');
});

test('标准 markdown 嵌套列表：展开后无碎片、子条目保留', () => {
  const html = renderWechatHtml(`- 外层一\n  - 内层甲\n  - 内层乙\n- 外层二`);
  assert.ok(!/<\/li>|<\/ul>|<li|<ul/.test(html), '嵌套 ul 展开残留碎片');
  for (const t of ['外层一', '内层甲', '内层乙', '外层二']) {
    assert.ok(html.includes(t), `条目「${t}」丢失`);
  }
});

test('不回归：标准无序/有序列表、段落、标题', () => {
  const html = renderWechatHtml(`## 小标题\n\n普通段落。\n\n- 甲\n- 乙\n\n1. 一\n2. 二`);
  assert.match(html, /<h2[^>]*>[^<]*小标题/);
  assert.match(html, /•<\/span>\s*甲/);
  assert.match(html, /•<\/span>\s*乙/);
  assert.match(html, /1\.<\/span>\s*一/);
  assert.match(html, /2\.<\/span>\s*二/);
  assert.ok(html.includes('普通段落'));
});

test('不回归：正文中间的 • 字符不被误改', () => {
  const html = renderWechatHtml('这句话里有个 • 符号在中间。');
  assert.ok(html.includes('这句话里有个 • 符号在中间。'));
});

test('阅读 token：段距/字距/断行、H2 节奏、列表间距与灰 bullet', () => {
  const html = renderWechatHtml(`## 小标题\n\n普通段落 OpenAI。\n\n- 甲\n- 乙\n  - 子`);
  assert.match(html, /margin:\s*1em\s+0/, '段落垂直约 1em、水平 0');
  assert.match(html, /letter-spacing:\s*0\.02em/, '字距 0.02em');
  assert.ok(!/word-break:\s*break-all/.test(html.match(/<p[^>]*>/)?.[0] || ''),
    '段落不应 break-all');
  assert.match(html, /margin:\s*1\.7em\s+0\s+0\.55em/, 'H2 上收下贴');
  assert.match(html, /padding:\s*0\s+8px/, '水平缩进只在外层 section');
  assert.match(html, /color:\s*#888[^"]*">•/, 'bullet 灰色');
  // 顶层列表：首条上 1em、末条下 1em、条间 0.4em
  assert.match(html, /margin:\s*1em\s+0\s+0\.4em\s+0px/, '顶层首条');
  assert.match(html, /margin:\s*0\.4em\s+0\s+1em\s+0px/, '顶层末条');
  assert.match(html, /margin:\s*0\.35em\s+0\s+0\.35em\s+16px/, '嵌套缩进 + 条间距');
});
