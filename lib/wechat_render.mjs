/**
 * wechat_render.mjs — markdown → 微信公众号内联样式 HTML
 *
 * 用 markdown-it 解析（表格/图片/嵌套列表/删除线全支持），juice 把 CSS 内联
 * （公众号编辑器只认内联 style，会剥 <style>）。配色见 wechat-theme.css。
 *
 * 依赖 markdown-it + juice —— 仅 web UI 排版导出用；封面 CLI 不依赖本模块。
 *
 * 用法：import { renderWechatHtml } from './lib/wechat_render.mjs'
 *       const html = renderWechatHtml(markdownString)
 */
import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import juice from 'juice';

const md = new MarkdownIt({ html: true, linkify: true, typographer: false, breaks: false });
const cssPath = path.join(import.meta.dirname, 'wechat-theme.css');
const css = fs.readFileSync(cssPath, 'utf-8');

// 行首字面 bullet（• 等）规范化为标准 markdown 列表标记 —— markdown-it 不认字面
// bullet，会把整块列表并成一个 <p>。缩进宽度按出现顺序归一化为嵌套深度 ×2 空格，
// 避免源文的深缩进（4+ 空格）被 CommonMark 判成 code block。fenced code 内不处理。
const LITERAL_BULLET_RE = /^([ \t]*)[•‣◦▪▫●○・][ \t]*(\S[\s\S]*)?$/;
function normalizeLiteralBullets(text) {
  const out = [];
  let inFence = false;
  let run = []; // 连续 bullet 行块：{ indent, content }
  const flush = () => {
    if (!run.length) return;
    const widths = [...new Set(run.map(r => r.indent))].sort((a, b) => a - b);
    if (out.length && out[out.length - 1].trim() !== '') out.push('');
    for (const r of run) out.push('  '.repeat(widths.indexOf(r.indent)) + '- ' + r.content);
    out.push('');
    run = [];
  };
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { flush(); inFence = !inFence; out.push(line); continue; }
    const m = inFence ? null : line.match(LITERAL_BULLET_RE);
    if (m) {
      run.push({ indent: m[1].replace(/\t/g, '    ').length, content: (m[2] || '').trim() });
    } else {
      flush();
      out.push(line);
    }
  }
  flush();
  return out.join('\n');
}

// 把 <ul>/<ol> 转成带 •/序号 的 <section>，规避微信编辑器在 <li> 间插空 bullet 的 bug。
// 由内向外循环展开：每轮只匹配不含嵌套列表的最内层 <ul>/<ol>（非贪婪一把抓会在嵌套时
// 停在第一个 </ul>，残留碎片），嵌套深度由前缀里未闭合的列表标签数得出。
//
// 节奏：条目间距 0.4em；顶层列表块首尾 1em 对齐段距；嵌套只缩进不额外撑块距。
// 水平：外层 section 已有 padding，条目左缘从 0 起，仅嵌套 +16px/层。
function transformListsForWechat(html) {
  const INNERMOST = /<(ul|ol)[^>]*>((?:(?!<\/?[uo]l)[\s\S])*?)<\/\1>/;
  const listDepth = (prefix) =>
    (prefix.match(/<[uo]l[\s>]/g) || []).length - (prefix.match(/<\/[uo]l>/g) || []).length;
  let m;
  while ((m = INNERMOST.exec(html))) {
    const depth = listDepth(html.slice(0, m.index));
    const bullet = depth === 0 ? '•' : '◦';
    const items = [...m[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)];
    const sections = items
      .map((li, i) => {
        const isFirst = i === 0;
        const isLast = i === items.length - 1;
        // 顶层块首尾贴段距；嵌套条目只保留条间距
        const marginTop = depth === 0 ? (isFirst ? '1em' : '0.4em') : '0.35em';
        const marginBottom = depth === 0 ? (isLast ? '1em' : '0.4em') : '0.35em';
        const left = depth * 16;
        const liStyle = `margin: ${marginTop} 0 ${marginBottom} ${left}px; line-height: 1.75; color: #333; padding: 0;`;
        const prefix = m[1] === 'ol' ? `${i + 1}.` : bullet;
        // bullet/序号略灰，不抢正文
        return `<section style="${liStyle}"><span style="color: #888;">${prefix}</span> ${li[1].trim()}</section>`;
      })
      .join('\n');
    html = html.slice(0, m.index) + sections + html.slice(m.index + m[0].length);
  }
  return html;
}

export function renderWechatHtml(markdown) {
  // 忠实渲染（含首个 # 标题）——所见即所得；标题要不要留在正文由用户自己决定
  let body = md.render(normalizeLiteralBullets(String(markdown || '').trim()));
  body = transformListsForWechat(body);
  // 水平缩进只留这一层；子块 margin 水平为 0（见 wechat-theme.css）
  body = `<section style="padding: 0 8px">${body}</section>`;
  return juice(`<style>${css}</style>${body}`, {
    removeStyleTags: true,
    preserveMediaQueries: false,
    preserveFontFaces: false,
    insertPreservedExtraCss: false,
  });
}
