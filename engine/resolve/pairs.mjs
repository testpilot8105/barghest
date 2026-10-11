// Candidate pairs: for every two mentions of the same type in the same scenario, a deterministic score and the
// reasons for it. Above 0.9 the rule decides; between 0.5 and 0.9 the local model decides (decide.mjs); below 0.5
// the pair is never raised. Shared identifiers decide on their own: a serial number, a student ID, a platform id.
import { handleKey, identifierKey, nameTokens, orgTokens, splitInitials } from './normalize.mjs';

// Which property is the name, which properties are hard identifiers, which property groups mentions (a boost).
export const TYPE_RULES = {
  Person: { name: 'fullName', tokens: nameTokens, ids: [], context: ['schoolId'], firstName: true },
  Organization: { name: 'name', tokens: orgTokens, ids: [], context: [] },
  Location: { name: 'name', tokens: nameTokens, ids: [], context: [] },
  Event: { name: 'summary', tokens: nameTokens, ids: [], context: [] },
  DigitalAccount: { name: 'handle', tokens: (s) => [handleKey(s)], ids: ['platformId'], context: ['platform'], sameContext: true },
  OnlineGroup: { name: 'name', tokens: orgTokens, ids: ['platformId'], context: ['platform'] },
  Incident: { name: 'label', tokens: nameTokens, ids: [], context: [] },
  Firearm: { name: 'label', tokens: orgTokens, ids: ['serial', 'feoRegistrationNo'], context: [] },
  EvidenceItem: { name: 'tag', tokens: (s) => [identifierKey(s)], ids: [], context: [] },
  School: { name: 'name', tokens: orgTokens, ids: ['depedId'], context: [] },
  LGU: { name: 'name', tokens: orgTokens, ids: [], context: ['province'] },
  Barangay: { name: 'name', tokens: orgTokens, ids: [], context: ['lguId'] },
  Hauler: { name: 'name', tokens: orgTokens, ids: ['registrationNo', 'tin'], context: [] },
  Contract: { name: 'contractNo', tokens: (s) => [identifierKey(s)], ids: [], context: [] },
  Facility: { name: 'name', tokens: orgTokens, ids: ['permitNo'], context: ['lguId'] },
  Vehicle: { name: 'plateNo', tokens: (s) => [identifierKey(s)], ids: ['bodyNo'], context: [] },
  Inspection: { name: 'label', tokens: nameTokens, ids: [], context: [] },
  Complaint: { name: 'label', tokens: nameTokens, ids: [], context: [] },
  // The `others` catch-all: the same normalised name and the same kind, nothing looser.
  Thing: { name: 'name', tokens: nameTokens, ids: [], context: ['kind'], sameContext: true },
};

export const AUTO = 0.9;
export const REVIEW = 0.5;

const plain = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The comparable key of one hard identifier. A platform id is its longest run of digits, so the model's
 * "strconv(884217700112233)" is the same id as 884217700112233; a platform id that only repeats the object's own
 * name (an export that gives no user id) is no id at all.
 */
function idKey(rule, id, o) {
  if (id !== 'platformId') return identifierKey(o[id]);
  const raw = String(o[id] ?? '');
  if (!raw || plain(raw) === plain(o[rule.name])) return '';
  const digits = (raw.match(/\d{6,}/g) ?? []).sort((x, y) => y.length - x.length)[0];
  return digits ?? identifierKey(raw);
}

/**
 * Whether two people's first words cannot be one name: two different full words (Joaquin, Rowena), or an initial
 * that does not start the other word ("J." against Nestor). nameTokens has already turned "LAST, FIRST" around.
 */
function firstNamesClash(ta, tb) {
  const [x, y] = [ta[0], tb[0]];
  if (!x || !y || x === y) return false;
  if (x.length === 1) return !y.startsWith(x);
  if (y.length === 1) return !x.startsWith(y);
  return true;
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((t) => B.has(t)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}

/** Score one pair. Returns null when there is nothing to compare. */
export function scorePair(type, a, b) {
  const rule = TYPE_RULES[type];
  if (!rule) return null;
  const reasons = [];
  let score = 0;

  // Hard identifiers: equal and non-empty means the same thing, whatever the names say.
  for (const id of rule.ids) {
    const ka = idKey(rule, id, a);
    const kb = idKey(rule, id, b);
    if (ka && kb) {
      if (ka === kb) {
        reasons.push(`same ${id} ${a[id]}`);
        score = Math.max(score, 0.98);
      } else {
        reasons.push(`different ${id}`);
        return { score: 0, reasons };
      }
    }
  }

  // Accounts only match inside one platform.
  if (rule.sameContext) {
    for (const c of rule.context) if (a[c] && b[c] && String(a[c]).toLowerCase() !== String(b[c]).toLowerCase()) return { score: 0, reasons: [`different ${c}`] };
  }

  const ta = rule.tokens(a[rule.name]);
  const tb = rule.tokens(b[rule.name]);
  if (ta.length === 0 || tb.length === 0) return score ? { score, reasons } : null;
  // Relatives share a surname: two people with different first names are never one person, whatever the model says.
  if (rule.firstName && !score && firstNamesClash(ta, tb)) return { score: 0, reasons: ['different first names'] };

  const keyA = ta.join(' ');
  const keyB = tb.join(' ');
  if (keyA === keyB) {
    reasons.push('same name after normalisation');
    score = Math.max(score, 0.97);
  } else {
    const { words: wa, initials: ia } = splitInitials(ta);
    const { words: wb, initials: ib } = splitInitials(tb);
    const setA = new Set(wa);
    const setB = new Set(wb);
    const shorter = wa.length <= wb.length ? wa : wb;
    const longerSet = wa.length <= wb.length ? setB : setA;
    const contained = shorter.length >= 2 && shorter.every((t) => longerSet.has(t));
    // An initial counts only when it stands for a word the other name has and this one lacks ("J." for Joaquin),
    // never for a word both already share ("D." against "Dela").
    const fits = (initials, ownWords, otherWords) => initials.length > 0 && initials.every((i) => otherWords.some((w) => w.startsWith(i) && !ownWords.includes(w)));
    const initialsFit = fits(ia, wa, wb) || fits(ib, wb, wa);
    const j = jaccard(wa, wb);
    if (contained && (ia.length === 0 && ib.length === 0)) {
      reasons.push(`every word of "${shorter.join(' ')}" is in the other name`);
      score = Math.max(score, shorter.length >= 3 || rule.tokens === orgTokens ? 0.95 : 0.9);
    } else if (contained && initialsFit) {
      reasons.push('words contained and the initials fit');
      score = Math.max(score, 0.85);
    } else if (initialsFit && j >= 0.5) {
      reasons.push(`initials fit, shared words ${Math.round(j * 100)}%`);
      score = Math.max(score, 0.8);
    } else if (j >= 0.5) {
      reasons.push(`shared words ${Math.round(j * 100)}%`);
      score = Math.max(score, 0.5 + 0.4 * j);
    } else if (!score) {
      return null;
    }
  }

  for (const c of rule.context) {
    if (a[c] && b[c] && String(a[c]) === String(b[c]) && !rule.sameContext) {
      reasons.push(`same ${c}`);
      score = Math.min(0.99, score + 0.04);
    }
  }
  return { score: Math.round(score * 100) / 100, reasons };
}

/** All pairs of one type worth a decision, highest score first. Mentions must share a token to be compared. */
export function candidatePairs(type, mentions) {
  const rule = TYPE_RULES[type];
  if (!rule) return [];
  const keyed = mentions.map((m) => ({ m, tokens: new Set(rule.tokens(m[rule.name])), ids: rule.ids.map((id) => identifierKey(m[id])).filter(Boolean) }));
  const pairs = [];
  for (let i = 0; i < keyed.length; i++) {
    for (let k = i + 1; k < keyed.length; k++) {
      const a = keyed[i];
      const b = keyed[k];
      if (a.m.scenario && b.m.scenario && a.m.scenario !== b.m.scenario) continue;
      const sharesToken = [...a.tokens].some((t) => t.length > 1 && b.tokens.has(t));
      const sharesId = a.ids.some((id) => b.ids.includes(id));
      if (!sharesToken && !sharesId) continue;
      const s = scorePair(type, a.m, b.m);
      if (s && s.score >= REVIEW) pairs.push({ a: a.m, b: b.m, ...s });
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}
