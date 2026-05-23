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

// 把 <ul>/<ol> 转成带 •/序号 的 <section>，规避微信编辑器在 <li> 间插空 bullet 的 bug
function transformListsForWechat(html) {
  const liStyle = 'margin: 0.5em 8px; line-height: 1.75; color: #333;';
  html = html.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/g, (_, inner) => {
    return [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
      .map(m => `<section style="${liStyle}">• ${m[1].trim()}</section>`)
      .join('\n');
  });
  html = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/g, (_, inner) => {
    return [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
      .map((m, i) => `<section style="${liStyle}">${i + 1}. ${m[1].trim()}</section>`)
      .join('\n');
  });
  return html;
}

export function renderWechatHtml(markdown) {
  // 忠实渲染（含首个 # 标题）——所见即所得；标题要不要留在正文由用户自己决定
  let body = md.render(String(markdown || '').trim());
  body = transformListsForWechat(body);
  body = `<section>${body}</section>`;
  return juice(`<style>${css}</style>${body}`, {
    removeStyleTags: true,
    preserveMediaQueries: false,
    preserveFontFaces: false,
    insertPreservedExtraCss: false,
  });
}
