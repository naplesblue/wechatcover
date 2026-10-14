/**
 * layout_check.mjs — 艺术指导输出的 layout 硬错校验（纯函数，供 gen_cover 重试循环调用）。
 * 只挑客观硬错（非法坐标 / 缺核心结构字段），有错就让 LLM 重出；软问题（重叠、留白多少、
 * pattern 选择）是设计取舍，不在这里管。
 */
const COLS = ['L', 'C', 'R'], ROWS = ['T', 'M', 'B'];
// 图上不渲染标题的语域（与 art_director.md「TEXT IN IMAGE」一致）
const NO_TITLE_REGISTERS = ['情绪', '感悟'];
function cellValid(cell) {
  if (typeof cell !== 'string') return false;
  const [c, r] = cell.trim().split('-');
  return COLS.includes(c) && ROWS.includes(r);
}
function zoneValid(zone) {
  if (typeof zone !== 'string' || !zone.trim()) return false;
  const parts = zone.split('..').map((s) => s.trim());
  return parts.length >= 1 && parts.length <= 2 && parts.every(cellValid);
}
// 返回该候选 layout 的硬错清单（空数组 = 通过）。
// 只查「渲染核心块」的坐标——标题区 + 各具名元素：它们坐标非法会让标题/焦点直接画不出来。
// 不查 focal_point / accent / negative_space：前者只是元信息，后两者非法时只是少画一个小块（优雅降级），
// 且 negative_space="none" 对满幅「字压图」是合理表达——硬卡会白白触发重出。
export function layoutErrors(c) {
  const errs = [];
  const L = c && c.layout;
  if (!L || typeof L !== 'object') { errs.push('layout 缺失或非对象'); return errs; }
  if (NO_TITLE_REGISTERS.includes(c.register)) {
    // 情绪 / 感悟图上不渲染标题：预留标题区 = 那 1/3 画面成空洞（实测 10 张情绪封面全是一侧大片空白）
    if (L.title && typeof L.title.zone === 'string' && L.title.zone.trim()) {
      errs.push(`${c.register}语域图上不渲染标题，layout 不得预留标题区（title.zone「${L.title.zone}」）——pattern 改用「全幅图」，title 写 null，主体组团占画面中部`);
    }
  } else if (!L.title || !zoneValid(L.title.zone)) errs.push(`title.zone 非法坐标「${L.title && L.title.zone}」`);
  (Array.isArray(L.elements) ? L.elements : []).forEach((el, i) => {
    if (!zoneValid(el && el.zone)) errs.push(`elements[${i}].zone 非法坐标「${el && el.zone}」`);
  });
  return errs;
}
