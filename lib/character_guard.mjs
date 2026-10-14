/**
 * character_guard.mjs — IP 角色 CHARACTER 段的确定性护栏（纯函数，供 gen_cover 调用）。
 *
 * 艺术指导 LLM 写 CHARACTER 段时偶尔违背预设，两类硬错交给代码兜底，不依赖 LLM 听话：
 *   1. 漏抄「钦定配色」句 → ensureCanonical 直接插回去（确定性修复，不必重出）
 *   2. 写了预设「角色段禁词」→ findBannedWords 查出来，由调用方让 LLM 重写
 *      （实测：被写了与 IP 标志特征冲突的描述词 → 图像模型改掉标志特征，IP 认不出）
 *
 * 规则全部来自 brand_system 预设的声明，代码里不写任何具体 IP 的词。
 */

const norm = (s) => s.replace(/\s+/g, ' ').trim();

// 取 "### 小节名…" 到下一个 ## / ### 标题之间的正文
function subsection(md, title) {
  const m = md.match(new RegExp(`\\n###\\s*${title}[^\\n]*\\n([\\s\\S]*?)(?=\\n##|$)`));
  return m ? m[1] : null;
}
const firstCodeBlock = (s) => s.match(/```[^\n]*\n([\s\S]*?)```/)?.[1] ?? null;

/** 从 brand_system 读出 { canonical: 钦定句|null, bannedWords: 禁词[] }。 */
export function parseCharacterRules(md) {
  let canonical = null;
  const canon = subsection(md, '钦定配色');
  if (canon) {
    // 两种写法：私有预设的行内 `这句："…"`；模板的代码块
    const inline = canon.match(/这句[：:]\s*["“]([\s\S]+?)["”]/);
    const raw = inline ? inline[1] : firstCodeBlock(canon);
    if (raw && norm(raw) && !raw.includes('{{')) canonical = norm(raw);  // {{占位}} = 模板没填
  }
  const banned = subsection(md, '角色段禁词');
  const bannedRaw = banned ? (firstCodeBlock(banned) ?? '') : '';
  const bannedWords = bannedRaw.includes('{{')
    ? []
    : bannedRaw.split(/[,，\n]/).map((w) => w.trim()).filter(Boolean);
  return { canonical, bannedWords };
}

// art_director.md 规定的 image_prompt 顶层段名；CHARACTER 段止于下一个顶层段
const TOP_SECTIONS = ['SUBJECT', 'STYLE', 'LIGHTING', 'COMPOSITION', 'COLOR PALETTE', 'TEXT IN IMAGE', 'NEGATIVE'];
const SECTION_START = new RegExp(`^(?:${TOP_SECTIONS.join('|')})\\b`, 'm');

/** 切出 CHARACTER 段（含标题行）；没有则 null。 */
export function extractCharacterSection(prompt) {
  const m = prompt.match(/^CHARACTER\b.*$/m);
  if (!m) return null;
  const rest = prompt.slice(m.index);
  const end = rest.slice(m[0].length).search(SECTION_START);
  return end < 0 ? rest : rest.slice(0, m[0].length + end).trimEnd();
}

/** 钦定句没原样出现（忽略空白差异）→ 插到 CHARACTER 标题行之后。没有 CHARACTER 段则不动。 */
export function ensureCanonical(prompt, canonical) {
  if (!canonical || norm(prompt).includes(canonical)) return { prompt, injected: false };
  const m = prompt.match(/^CHARACTER\b.*$/m);
  if (!m) return { prompt, injected: false };
  const at = m.index + m[0].length;
  return { prompt: `${prompt.slice(0, at)}\n${canonical}.${prompt.slice(at)}`, injected: true };
}

// 否定从句（"the eyes are NEVER visible" / "no big cartoon eyes"）里的禁词是在强化约束，不算违规
const NEGATION = /\b(?:no|not|never|without|hidden)\b|n't\b/i;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 返回 CHARACTER 段里（扣掉钦定句、跳过否定从句）命中的禁词，去重保序。 */
export function findBannedWords(prompt, bannedWords, canonical) {
  if (!bannedWords?.length) return [];
  let sec = extractCharacterSection(prompt);
  if (!sec) return [];
  sec = norm(sec);
  if (canonical) sec = sec.split(canonical).join(' ');
  const hits = [];
  for (const clause of sec.split(/[,;.:()!?—–]/)) {
    if (NEGATION.test(clause)) continue;
    for (const w of bannedWords) {
      // 词边界含连字符：wide-eyed 算一个词，eye 不命中 eyeing
      if (new RegExp(`(?<![A-Za-z-])${escapeRe(w)}(?![A-Za-z-])`, 'i').test(clause) && !hits.includes(w)) hits.push(w);
    }
  }
  return hits;
}

/**
 * 对一批候选跑护栏：钦定句漏抄 → 就地补回（记入 injected）；
 * 禁词命中 / 缺 CHARACTER 段 → 记入 issues，由调用方决定重出。预设没声明规则则什么都不做。
 */
export function guardCandidates(candidates, { canonical, bannedWords }) {
  const injected = [], issues = [];
  if (!canonical && !bannedWords?.length) return { injected, issues };
  candidates.forEach((c, index) => {
    if (!c.image_prompt) return;  // 缺 image_prompt 由调用方的 promptBad 处理
    if (!extractCharacterSection(c.image_prompt)) { issues.push({ index, kind: 'no-character' }); return; }
    const r = ensureCanonical(c.image_prompt, canonical);
    if (r.injected) { c.image_prompt = r.prompt; injected.push(index); }
    const words = findBannedWords(c.image_prompt, bannedWords, canonical);
    if (words.length) issues.push({ index, kind: 'banned', words });
  });
  return { injected, issues };
}
