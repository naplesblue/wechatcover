// 把 layout（三分网格版式）渲染成一张 47:20 的 HTML 线框图。
// 用途：「先确定构图，再出图」——出图前肉眼审阅版式，避免把构图整个交给图像模型即兴。
// 颜色是示意编码（按角色区分），不是输出色板。

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]
  ));
}

// "L-T..C-B" → CSS grid-area "rowStart / colStart / rowEnd / colEnd"；单格 "C-M" 亦可。非法返回 null。
function zoneToArea(zone) {
  if (typeof zone !== 'string' || !zone) return null;
  const cols = { L: 1, C: 2, R: 3 }, rows = { T: 1, M: 2, B: 3 };
  const cell = (s) => { const [c, r] = s.trim().split('-'); return [rows[r], cols[c]]; };
  const parts = zone.split('..').map((s) => s.trim());
  const a = cell(parts[0]);
  const b = parts[1] ? cell(parts[1]) : a;
  if (!a[0] || !a[1] || !b[0] || !b[1]) return null;
  const r1 = Math.min(a[0], b[0]), r2 = Math.max(a[0], b[0]);
  const c1 = Math.min(a[1], b[1]), c2 = Math.max(a[1], b[1]);
  return `${r1} / ${c1} / ${r2 + 1} / ${c2 + 1}`;
}

export function renderWireframe(c) {
  const L = c.layout || {};
  const blocks = [];
  const add = (zone, cls, label) => {
    const area = zoneToArea(zone);
    if (!area) return;
    blocks.push(`<div class="zone ${cls}" style="grid-area:${area}">${label}</div>`);
  };

  // 留白先画（在底层），其次辅助/焦点，标题、点睛在上层
  add(L.negative_space, 'neg', '<span class="tag">留白</span>');
  for (const el of (L.elements || [])) {
    const focal = el.role === 'focal';
    add(el.zone, focal ? 'focal' : 'support',
      `<span class="tag">${focal ? '焦点' : '辅助'}</span>${esc(el.what)}`);
  }
  if (L.title?.zone) add(L.title.zone, 'title', `<span class="tag">标题</span><b>${esc(c.title_text)}</b>`);
  if (L.accent?.zone) add(L.accent.zone, 'accent', `<span class="dot">点睛${L.accent.what ? '·' + esc(L.accent.what) : ''}</span>`);

  const cells = [];
  for (const r of ['T', 'M', 'B']) for (const col of ['L', 'C', 'R']) cells.push(`<div class="cell">${col}-${r}</div>`);

  const metaLine = [
    c.hook ? `钩子：${esc(c.hook)}` : '',
    L.pattern ? `版式：${esc(L.pattern)}` : '',
    L.density ? `密度：${esc(L.density)}` : '',
    L.reading_flow ? `视线：${esc(L.reading_flow)}` : '',
  ].filter(Boolean).join('　·　');

  return `<!doctype html>
<html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>版式预览 — ${esc(c.title_text)}</title>
<style>
  :root{ --paper:#FAF3DD; --ink:#1B4965; --line:#cbb89a; }
  *{box-sizing:border-box}
  body{margin:0;background:#efe7cf;color:#33312b;font:15px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;padding:24px;display:flex;flex-direction:column;align-items:center;gap:14px}
  h1{font-size:16px;margin:0;color:#5a5648;font-weight:600}
  .meta{font-size:13px;color:#6b6657;text-align:center;max-width:960px}
  .stage{width:min(960px,92vw)}
  .grid{position:relative;aspect-ratio:47/20;background:var(--paper);border:1px solid var(--line);box-shadow:0 6px 24px rgba(0,0,0,.12)}
  .bg,.overlay{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr)}
  .overlay{pointer-events:none}
  .cell{border:1px dashed var(--line);padding:4px 6px;font-size:11px;color:#c3b48f}
  .zone{margin:6px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:8px;font-size:13px;font-weight:600;overflow:hidden;line-height:1.3}
  .tag{display:block;font-size:11px;font-weight:700;letter-spacing:.05em;opacity:.85;margin-bottom:2px}
  .title{background:rgba(27,73,101,.16);border:2px solid var(--ink);color:var(--ink)}
  .title b{font-size:20px;line-height:1.2}
  .focal{background:rgba(42,157,143,.16);border:2px solid #2A9D8F;color:#1f6b61}
  .support{background:rgba(141,153,174,.18);border:2px dashed #8D99AE;color:#5c6479;font-weight:500}
  .neg{background:repeating-linear-gradient(45deg,transparent,transparent 7px,rgba(203,184,154,.30) 7px,rgba(203,184,154,.30) 9px);border:1px dashed var(--line);color:#a99a78;font-weight:500}
  .accent{background:transparent;border:none;justify-content:flex-end;align-items:flex-end;padding:8px}
  .accent .dot{background:#E07A5F;color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;box-shadow:0 2px 6px rgba(224,122,95,.5)}
  .legend{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:#6b6657}
  .legend span{display:inline-flex;align-items:center;gap:5px}
  .sw{width:14px;height:14px;border-radius:3px;display:inline-block}
</style></head>
<body>
  <h1>版式预览（出图前确认构图）</h1>
  <div class="meta">${metaLine}</div>
  <div class="stage"><div class="grid">
    <div class="bg">${cells.join('')}</div>
    <div class="overlay">
    ${blocks.join('\n    ')}
    </div>
  </div></div>
  <div class="legend">
    <span><i class="sw" style="background:rgba(27,73,101,.16);border:2px solid #1B4965"></i>标题</span>
    <span><i class="sw" style="background:rgba(42,157,143,.16);border:2px solid #2A9D8F"></i>焦点</span>
    <span><i class="sw" style="background:rgba(141,153,174,.18);border:2px dashed #8D99AE"></i>辅助</span>
    <span><i class="sw" style="background:#E07A5F"></i>点睛</span>
    <span><i class="sw" style="background:repeating-linear-gradient(45deg,#efe7cf,#efe7cf 4px,#cbb89a 4px,#cbb89a 6px)"></i>留白</span>
  </div>
</body></html>`;
}
