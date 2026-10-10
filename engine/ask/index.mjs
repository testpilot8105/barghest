// Ask the system. No agent loop: deterministic retrieval first (objects by title or id, the paths between them,
// passages by embedding and by keyword), then one local-model call that may only answer from that material and
// must cite passage ids. Citations are checked against the material before they are returned; a question with no
// supporting records is refused without calling the model. Keyword search and refusal work with the model off.
import { nameTokens, stripDiacritics } from '../resolve/normalize.mjs';
import { whatConnects } from '../queries/graph.mjs';
import { askPrompt, SYSTEM_ASK } from '../extract/prompts.mjs';
import { answerSchema, jsonSchemaOf } from '../extract/schemas.mjs';

const EVIDENCE = new Set(['Document', 'Passage', 'SourceRecord', 'Resolution', 'Relationship']);
/** Passages the model reads for one question, and so the passages the search hands it. */
const ASK_PASSAGES = 10;
// Type words ("incident", "hauler", "LGUs") are kept: they are keywords in the text and they point the question at
// objects of that type (typeWords below).
const STOP = new Set(['what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'how', 'why', 'does', 'did', 'the', 'and', 'that', 'this', 'with', 'from', 'into', 'than', 'more', 'about', 'between', 'connects', 'connect', 'connected', 'link', 'links', 'linked', 'say', 'said', 'serve', 'serves', 'have', 'has', 'any', 'all', 'one', 'are', 'was', 'were', 'for', 'ang', 'ng', 'sa', 'mga', 'ano', 'sino', 'saan', 'kailan', 'paano', 'bakit']);

export function queryTerms(question) {
  return [...new Set(nameTokens(question).filter((t) => t.length >= 3 && !STOP.has(t)))];
}

/** The part of a term a passage must contain: "hauler" finds "Hauling", "inspections" finds "inspected". */
export function termStem(t) {
  const s = t.replace(/(?:ions?|ings?|ers?|es|s)$/, '');
  return s.length >= 3 ? s : t;
}

/** Whether a passage's text holds a term at the start of a word, diacritics aside ("pena" finds "Peña"). */
function holds(text, stem) {
  let at = text.indexOf(stem);
  while (at !== -1) {
    if (at === 0 || !/[a-z0-9]/.test(text[at - 1])) return true;
    at = text.indexOf(stem, at + 1);
  }
  return false;
}

/** The object types a question names by word: apiName, display name or plural, in the question's own tokens. */
function typeWords(meta, terms) {
  const types = [];
  for (const [type, t] of Object.entries(meta.objectTypes)) {
    if (EVIDENCE.has(type) || type === 'Event') continue;
    const words = [type, t.displayName, t.pluralDisplayName].filter(Boolean).flatMap((w) => nameTokens(w));
    if (words.length && words.some((w) => terms.includes(w))) types.push(type);
  }
  return types;
}

function degree(data, type, pk) {
  let n = 0;
  for (const link of ['relationshipsFrom', 'relationshipsTo']) {
    try {
      n += data.getLinksOrThrow(type, pk, link).length;
    } catch {
      // a type without relationship links
    }
  }
  return n;
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const passageView = (p) => ({ pk: String(p.__primaryKey), documentId: p.documentId ?? '', label: p.label ?? '', text: p.text ?? '' });

/** Embed every passage of a scenario (or all) that has no embedding yet. */
export async function embedAll({ engine, store, llm, scenario = null, batch = 16 }) {
  const have = new Set(store.embeddings().map((e) => e.passageId));
  const todo = [...engine.data.getObjectsOfType('Passage')].filter((p) => !have.has(String(p.__primaryKey)) && (!scenario || engine.data.getObject('Document', p.documentId)?.scenario === scenario));
  let done = 0;
  for (let i = 0; i < todo.length; i += batch) {
    const slice = todo.slice(i, i + batch);
    const vectors = await llm.embed(slice.map((p) => p.text), { documentId: slice[0].documentId });
    slice.forEach((p, k) => store.putEmbedding(String(p.__primaryKey), llm.models.embed, vectors[k]));
    done += slice.length;
  }
  return { embedded: done, total: have.size + done };
}

/** Passages for a question: by embedding when the model is on and embeddings exist, always by keyword too. */
export async function searchPassages({ engine, store, llm, question, scenario = null, k = 8 }) {
  const data = engine.data;
  const inScenario = (p) => !scenario || data.getObject('Document', p.documentId)?.scenario === scenario;
  const terms = queryTerms(question);
  const scored = new Map();
  const bump = (p, score, how) => {
    const cur = scored.get(String(p.__primaryKey));
    if (!cur || cur.score < score) scored.set(String(p.__primaryKey), { ...passageView(p), score, how });
  };

  const stems = terms.map(termStem);
  for (const p of data.getObjectsOfType('Passage')) {
    if (!inScenario(p)) continue;
    const text = stripDiacritics(String(p.text ?? '')).toLowerCase();
    const hits = stems.filter((s) => holds(text, s)).length;
    if (hits) bump(p, hits / Math.max(terms.length, 1), 'keyword');
  }

  let semantic = 0;
  if (llm.allowed()) {
    const embeddings = store.embeddings();
    if (embeddings.length) {
      const [q] = await llm.embed([question], { purpose: 'embed-query' });
      const ranked = embeddings
        .map((e) => ({ e, sim: cosine(q, e.vector) }))
        .sort((x, y) => y.sim - x.sim)
        .slice(0, k);
      for (const { e, sim } of ranked) {
        const p = data.getObject('Passage', e.passageId);
        if (p && inScenario(p) && sim > 0.3) {
          bump(p, sim, 'semantic');
          semantic++;
        }
      }
    }
  }
  return { terms, semantic, passages: fileByFile([...scored.values()]).slice(0, k) };
}

/** Each file's best passage first, then each file's second best, and so on, so one long file never crowds out the rest. */
function fileByFile(passages) {
  const byFile = new Map();
  for (const p of [...passages].sort((x, y) => y.score - x.score)) {
    if (!byFile.has(p.documentId)) byFile.set(p.documentId, []);
    byFile.get(p.documentId).push(p);
  }
  const out = [];
  for (let round = 0; out.length < passages.length; round++) {
    out.push(...[...byFile.values()].filter((list) => list[round]).map((list) => list[round]).sort((x, y) => y.score - x.score));
  }
  return out;
}

/**
 * Canonical objects the question names, by id (P-001) or by title words, then the objects of each type it names by
 * word ("the incident", "which hauler"), the most linked first, marked `byType`. Named objects come first.
 */
export function findObjects({ engine, meta, question, scenario = null, limit = 8, perType = 3 }) {
  const data = engine.data;
  const terms = queryTerms(question);
  const ids = (question.match(/\b[A-Z]{1,3}-[A-Za-z0-9]{3,}\b/g) ?? []).map((s) => s.toUpperCase());
  const named = typeWords(meta, terms);
  const found = [];
  const typed = [];
  for (const type of Object.keys(meta.objectTypes)) {
    if (EVIDENCE.has(type) || type === 'Event') continue;
    const ofType = [];
    for (const o of data.getObjectsOfType(type)) {
      if (o.canonicalId) continue;
      if (scenario && o.scenario && o.scenario !== scenario) continue;
      const pk = String(o.__primaryKey).toUpperCase();
      const title = String(o.__title ?? '');
      const tokens = nameTokens(title);
      const byId = ids.includes(pk);
      const hits = tokens.filter((t) => terms.includes(t)).length;
      const aliasHits = Array.isArray(o.aliases) ? o.aliases.some((a) => nameTokens(a).some((t) => terms.includes(t) && t.length >= 4)) : false;
      const score = byId ? 10 : hits >= 2 ? hits * 2 : hits === 1 && tokens.length === 1 ? 2 : aliasHits ? 1.5 : 0;
      if (score > 0) found.push({ type, pk: String(o.__primaryKey), title, score });
      else if (named.includes(type)) ofType.push({ type, pk: String(o.__primaryKey), title, score: degree(data, type, o.__primaryKey), byType: true });
    }
    typed.push(...ofType.sort((x, y) => y.score - x.score).slice(0, perType));
  }
  return [...found.sort((x, y) => y.score - x.score).slice(0, limit), ...typed.sort((x, y) => y.score - x.score).slice(0, limit)];
}

function relationshipDetail(data, meta, obj) {
  const lines = [];
  for (const link of ['relationshipsFrom', 'relationshipsTo']) {
    let rels = [];
    try {
      rels = data.getLinksOrThrow(obj.type, obj.pk, link);
    } catch {
      continue;
    }
    for (const r of rels.slice(0, 8)) lines.push(`${r.label} [${r.status}, ${r.confidence ?? '?'}]`);
  }
  return lines.join('; ');
}

/** The people one object is linked to through Relationships, with the passages that state each link. */
function linkedPeople(data, obj) {
  const people = new Map();
  for (const link of ['relationshipsFrom', 'relationshipsTo']) {
    let rels = [];
    try {
      rels = data.getLinksOrThrow(obj.type, obj.pk, link);
    } catch {
      continue;
    }
    for (const r of rels) {
      const end = link === 'relationshipsFrom' ? 'to' : 'from';
      if (r[`${end}Type`] !== 'Person') continue;
      const pk = String(r[`${end}PersonId`] ?? r[`${end}Id`]);
      const p = data.getObject('Person', pk);
      if (!p) continue;
      const cur = people.get(pk) ?? { type: 'Person', pk, title: String(p.__title ?? pk), passageIds: [] };
      cur.passageIds.push(...(r.passageIds ?? []));
      people.set(pk, cur);
    }
  }
  return [...people.values()].slice(0, 6);
}

export async function ask({ engine, meta, store, llm, question, scenario = null }) {
  const data = engine.data;
  const q = String(question ?? '').trim();
  if (!q) throw Object.assign(new Error('question is required'), { status: 400 });

  const objects = findObjects({ engine, meta, question: q, scenario });
  const passageIds = new Set();
  const passages = [];
  const addPassage = (p) => {
    if (p && !passageIds.has(p.pk)) {
      passageIds.add(p.pk);
      passages.push(p);
    }
  };

  // Graph facts: each found object's relationships, and the paths between the two ends: the best named object and
  // the best of the type the question names ("what connects Joaquin to the incident"), else the two best matches.
  const detailed = objects.map((o) => ({ ...o, detail: relationshipDetail(data, meta, o) }));
  const relationships = [];
  const byName = objects.filter((o) => !o.byType);
  const byType = objects.filter((o) => o.byType);
  // Never a path between two things of one type (two incidents): with no one named, the two best of different types.
  const ends = byName.length && byType.length ? [byName[0], byType[0]] : byName.length ? byName.slice(0, 2) : [byType[0], byType.find((o) => o.type !== byType[0]?.type)].filter(Boolean);
  // With no one named, the people linked to what the question names ("the incident": who took, who is held).
  if (!byName.length) {
    for (const o of byType) {
      for (const person of linkedPeople(data, o)) {
        if (detailed.length >= 16) break;
        if (!detailed.some((d) => d.type === 'Person' && d.pk === person.pk)) detailed.push({ ...person, detail: relationshipDetail(data, meta, person) });
        for (const id of person.passageIds) addPassage(passageView(data.getObject('Passage', id) ?? { __primaryKey: id, text: '' }));
      }
    }
  }
  if (ends.length === 2) {
    const path = whatConnects(data, meta, `${ends[0].type}:${ends[0].pk}`, `${ends[1].type}:${ends[1].pk}`);
    if (path.found) {
      relationships.push(...path.relationships);
      for (const o of path.objects) if (!detailed.some((d) => d.type === o.type && d.pk === o.pk)) detailed.push({ ...o, detail: 'on the path' });
      for (const p of path.passages) addPassage(p);
    }
  }
  for (const o of objects) {
    for (const link of ['relationshipsFrom', 'relationshipsTo']) {
      let rels = [];
      try {
        rels = data.getLinksOrThrow(o.type, o.pk, link);
      } catch {
        continue;
      }
      for (const r of rels.slice(0, 8)) for (const id of r.passageIds ?? []) addPassage(passageView(data.getObject('Passage', id) ?? { __primaryKey: id, text: '' }));
    }
  }
  const search = await searchPassages({ engine, store, llm, question: q, scenario, k: ASK_PASSAGES });
  for (const p of search.passages) addPassage(p);
  const material = passages.filter((p) => p.text);

  const base = { question: q, objects: detailed, relationships, retrieval: { terms: search.terms, semantic: search.semantic, passages: material.length } };
  if (material.length === 0) return { ...base, answer: 'no supporting records', citations: [], refused: true, model: null };
  if (!llm.allowed()) return { ...base, answer: 'no supporting records (the local model is off; the records above were found by keyword)', citations: material.slice(0, 3).map((p) => ({ passageId: p.pk, quote: p.text.slice(0, 120) })), refused: true, model: null };

  const r = await llm.chatJson({ system: SYSTEM_ASK, prompt: askPrompt({ question: q, objects: detailed, passages: material.slice(0, ASK_PASSAGES) }), schema: jsonSchemaOf(answerSchema), purpose: 'ask' });
  if (!r.ok) return { ...base, answer: 'no supporting records (the model gave no valid answer)', citations: [], refused: true, model: r.model };
  const v = answerSchema.safeParse(r.data);
  if (!v.success) return { ...base, answer: 'no supporting records (the model answer did not match the schema)', citations: [], refused: true, model: r.model };

  const byId = new Map(material.map((p) => [p.pk, p]));
  const citations = v.data.citations
    .filter((c) => byId.has(c.passageId))
    .map((c) => {
      const p = byId.get(c.passageId);
      const quote = String(c.quote ?? '').trim();
      const verbatim = quote && p.text.toLowerCase().includes(quote.slice(0, 40).toLowerCase());
      return { passageId: c.passageId, quote: verbatim ? quote : p.text.slice(0, 160), verbatim };
    });
  const refused = v.data.refused || citations.length === 0;
  return {
    ...base,
    answer: refused && citations.length === 0 ? 'no supporting records' : v.data.answer,
    // The model's own words, kept on a refusal too, so the screen can show what it said.
    modelText: v.data.answer,
    citations,
    refused,
    model: r.model,
    latencyMs: r.latencyMs,
    promptTokens: r.promptTokens,
    outputTokens: r.outputTokens,
  };
}
