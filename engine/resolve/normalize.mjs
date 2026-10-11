// Deterministic normalisation of the strings resolution compares: names, organisation names, handles and
// identifiers. The same spelling rules for every type, so two mentions that differ only in case, punctuation,
// diacritics, honorifics, suffixes, "LAST, FIRST" order or corporate boilerplate normalise to the same tokens.

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'atty', 'engr', 'hon', 'sir', 'madam', 'sgt', 'lt', 'cpt', 'capt', 'col', 'ltcol', 'maj', 'cpl', 'pfc', 'det', 'ofc', 'prof', 'rev', 'fr', 'bro', 'sis']);
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
const CORPORATE = new Set(['inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'llc', 'enterprises', 'enterprise', 'services', 'service', 'svcs', 'svc', 'the', 'of', 'and', 'group', 'trading', 'general', 'merchandise', 'opc']);
const ABBREVIATIONS = { svcs: 'services', svc: 'service', corp: 'corporation', inc: 'incorporated', ent: 'enterprises', bgy: 'barangay', brgy: 'barangay', mun: 'municipality', nhs: 'national high school', es: 'elementary school' };

export function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Tokens of a person or place name: lower case, no diacritics or punctuation, "LAST, FIRST" turned around. */
export function nameTokens(raw) {
  let s = stripDiacritics(String(raw ?? '')).toLowerCase();
  if (s.includes(',')) {
    const [last, ...rest] = s.split(',');
    s = `${rest.join(' ')} ${last}`;
  }
  const tokens = s.replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  const out = [];
  for (const t of tokens) {
    if (HONORIFICS.has(t) || SUFFIXES.has(t)) continue;
    out.push(ABBREVIATIONS[t] ?? t);
  }
  return out.join(' ').split(' ').filter(Boolean);
}

/** Tokens of an organisation or hauler name: as above, with corporate boilerplate dropped. */
export function orgTokens(raw) {
  // "J.R.M." -> "jrm" before punctuation goes.
  const compact = stripDiacritics(String(raw ?? '')).toLowerCase().replace(/\b([a-z])\.(?=[a-z]\.)/g, '$1').replace(/\b([a-z])\.([a-z])\b/g, '$1$2').replace(/\.(?=[a-z])/g, '');
  const tokens = compact.replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).map((t) => ABBREVIATIONS[t] ?? t);
  return tokens.filter((t) => !CORPORATE.has(t));
}

export function handleKey(raw) {
  return stripDiacritics(String(raw ?? '')).toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9._]+/g, '');
}

export function identifierKey(raw) {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

/** The full-word tokens and the single-letter initials of a token list. */
export function splitInitials(tokens) {
  return { words: tokens.filter((t) => t.length > 1), initials: tokens.filter((t) => t.length === 1) };
}
