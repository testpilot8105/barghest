// Ask the system. No agent loop: deterministic retrieval first (objects by title or id, the paths between them,
// passages by embedding and by keyword), then one local-model call that may only answer from that material and
// must cite passage ids. Citations are checked against the material before they are returned; a question with no
// supporting records is refused without calling the model. Keyword search and refusal work with the model off.
import { nameTokens } from '../resolve/normalize.mjs';
import { whatConnects } from '../queries/graph.mjs';
import { askPrompt, SYSTEM_ASK } from '../extract/prompts.mjs';
import { answerSchema, jsonSchemaOf } from '../extract/schemas.mjs';

const EVIDENCE = new Set(['Document', 'Passage', 'SourceRecord', 'Resolution', 'Relationship']);
const STOP = new Set(['what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'how', 'why', 'does', 'did', 'the', 'and', 'that', 'this', 'with', 'from', 'into', 'than', 'more', 'about', 'between', 'connects', 'connect', 'connected', 'link', 'links', 'linked', 'say', 'said', 'serve', 'serves', 'have', 'has', 'any', 'all', 'one', 'are', 'was', 'were', 'for', 'ang', 'ng', 'sa', 'mga', 'ano', 'sino', 'saan', 'kailan', 'paano', 'bakit', 'person', 'incident', 'hauler', 'lgu', 'lgus', 'inspection', 'inspections']);

export function queryTerms(question) {
  return [...new Set(nameTokens(question).filter((t) => t.length >= 3 && !STOP.has(t)))];
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

  for (const p of data.getObjectsOfType('Passage')) {
    if (!inScenario(p)) continue;
    const text = String(p.text ?? '').toLowerCase();
    const hits = terms.filter((t) => text.includes(t)).length;
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
  return { terms, semantic, passages: [...scored.values()].sort((x, y) => y.score - x.score).slice(0, k) };
}

/** Canonical objects the question names, by id (P-001) or by title words. */
export function findObjects({ engine, meta, question, scenario = null, limit = 8 }) {
  const data = engine.data;
  const terms = queryTerms(question);
  const ids = (question.match(/\b[A-Z]{1,3}-[A-Za-z0-9]{3,}\b/g) ?? []).map((s) => s.toUpperCase());
  const found = [];
  for (const type of Object.keys(meta.objectTypes)) {
    if (EVIDENCE.has(type) || type === 'Event') continue;
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
    }
  }
  return found.sort((x, y) => y.score - x.score).slice(0, limit);
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

  // Graph facts: each found object's relationships, and the paths between the two best matches.
  const detailed = objects.map((o) => ({ ...o, detail: relationshipDetail(data, meta, o) }));
  const relationships = [];
  if (objects.length >= 2) {
    const path = whatConnects(data, meta, `${objects[0].type}:${objects[0].pk}`, `${objects[1].type}:${objects[1].pk}`);
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
  const search = await searchPassages({ engine, store, llm, question: q, scenario });
  for (const p of search.passages) addPassage(p);
  const material = passages.filter((p) => p.text);

  const base = { question: q, objects: detailed, relationships, retrieval: { terms: search.terms, semantic: search.semantic, passages: material.length } };
  if (material.length === 0) return { ...base, answer: 'no supporting records', citations: [], refused: true, model: null };
  if (!llm.allowed()) return { ...base, answer: 'no supporting records (the local model is off; the records above were found by keyword)', citations: material.slice(0, 3).map((p) => ({ passageId: p.pk, quote: p.text.slice(0, 120) })), refused: true, model: null };

  const r = await llm.chatJson({ system: SYSTEM_ASK, prompt: askPrompt({ question: q, objects: detailed, passages: material.slice(0, 10) }), schema: jsonSchemaOf(answerSchema), purpose: 'ask' });
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
    citations,
    refused,
    model: r.model,
    latencyMs: r.latencyMs,
    promptTokens: r.promptTokens,
    outputTokens: r.outputTokens,
  };
}
