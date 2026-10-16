/**
 * optional_blocks.mjs — brand_system 预设里的「可选段」按概率抽签（纯函数，供 gen_cover 调用）。
 *
 * 「不定期出现」这类频率是确定性决策：交给 LLM 自己判断会几乎每张都放（实测 6/8），
 * 因为每次调用彼此独立、LLM 不知道之前放没放过。所以在把预设交给 LLM 之前由代码抽签。
 *
 * 预设写法（同名段只抽一次签，多处保持一致；「否则」部分可省略）：
 *   <!-- 可选：白猫 1/3 -->
 *   抽中时保留的内容
 *   <!-- 否则 -->
 *   没抽中时换成的内容
 *   <!-- /可选 -->
 */

const BLOCK = /<!--\s*可选[:：]\s*(\S+)\s+([\d./]+)\s*-->([\s\S]*?)(?:<!--\s*否则\s*-->([\s\S]*?))?<!--\s*\/可选\s*-->(\n?)/g;

function parseProbability(s) {
  const [a, b] = s.split('/');
  const p = b === undefined ? Number(a) : Number(a) / Number(b);
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new Error(`可选段概率非法「${s}」（用 1/3 或 0.33）`);
  return p;
}

/**
 * 返回 { md: 抽签后的预设, decisions: { 段名: 是否抽中 } }。
 * rng: () => [0,1) 的随机数（测试可注入）；overrides: { 段名: true|false } 强制开关，不抽签。
 */
export function applyOptionalBlocks(md, rng = Math.random, overrides = {}) {
  const decisions = {};
  const out = md.replace(BLOCK, (_, name, prob, onText, offText = '', nl) => {
    if (!(name in decisions)) {
      decisions[name] = name in overrides ? overrides[name] : rng() < parseProbability(prob);
    }
    const kept = (decisions[name] ? onText : offText).trim();
    return kept ? kept + nl : '';
  });
  return { md: out, decisions };
}

/** 解析 CLI `--optional 白猫=on,彩蛋=off` → { 白猫: true, 彩蛋: false }。 */
export function parseOverrides(arg) {
  if (!arg || typeof arg !== 'string') return {};
  const o = {};
  for (const pair of arg.split(/[,，]/).map((s) => s.trim()).filter(Boolean)) {
    const [name, v] = pair.split('=').map((s) => s && s.trim());
    if (v !== 'on' && v !== 'off') throw new Error(`--optional 取值须为 on|off：「${pair}」`);
    o[name] = v === 'on';
  }
  return o;
}
