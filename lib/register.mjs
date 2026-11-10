/**
 * register.mjs — 「这张封面画不画标题」的唯一判定（纯函数）。
 *
 * register 是艺术指导 LLM 输出的语域字段，约定取值 信息 / 情绪 / 感悟（art_director.md）；
 * 情绪、感悟 两类图上不渲染标题。
 *
 * 只取第一个括号前的主值做精确比较。prod 实测（2026-11，478 个 meta）LLM 的漂移形态是
 * 「约定值 + 括号注释」，如「信息（科技/产品 · 本地隐私切入，带安心氛围）」——
 * 旧的模糊正则（/情绪|情感|氛围|…/）会被注释里的「氛围」误判成无标题图，跳过标题 QA。
 */
const NO_TITLE_REGISTERS = ['情绪', '感悟'];

export function noTitleRegister(register) {
  const head = String(register || '').split(/[（(]/)[0].trim();
  return NO_TITLE_REGISTERS.includes(head);
}
