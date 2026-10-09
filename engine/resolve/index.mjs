// Entity resolution: mentions of the same type in one scenario become clusters; each cluster of two or more gets a
// canonical object (derived, with every spelling kept as an alias) and every member points at it through
// canonicalId. Originals are never merged away. Relationships keep fromId / toId as the mention-level truth and get
// their foreign keys re-pointed at the canonical objects, so the graph has one node per real thing. Idempotent:
// run it again and the same clusters give the same canonical ids.
import { createHash } from 'node:crypto';
import { toServerObject } from '../faux.mjs';
import { resolveOwners } from './owners.mjs';
import { AUTO, candidatePairs, TYPE_RULES } from './pairs.mjs';

const ID_PREFIX = {
  Person: 'P', Organization: 'O', Location: 'L', Event: 'E', DigitalAccount: 'A', OnlineGroup: 'G', Incident: 'I', Firearm: 'F',
  EvidenceItem: 'EV', School: 'S', LGU: 'LGU', Barangay: 'B', Hauler: 'H', Contract: 'C', Facility: 'FA', Vehicle: 'V', Inspection: 'IN', Complaint: 'CO', Thing: 'T',
};

const ENTITY_TYPES = Object.keys(TYPE_RULES);

class UnionFind {
  constructor() {
    this.parent = new Map();
  }
  find(x) {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r);
    while (this.parent.get(x) !== r) {
      const next = this.parent.get(x);
      this.parent.set(x, r);
      x = next;
    }
    return r;
  }
  union(a, b) {
    this.parent.set(this.find(a), this.find(b));
  }
}

const isMention = (o) => !!(o.passageId || o.recordId);
const isCanonical = (o) => !o.canonicalId && !isMention(o);

/** The deterministic id of the Resolution for one pair, so a re-run overwrites rather than duplicates. */
export function resolutionIdFor(type, a, b) {
  const [x, y] = [String(a), String(b)].sort();
  return `RS-${createHash('sha1').update(`${type}|${x}|${y}`).digest('hex').slice(0, 8)}`;
}

/**
 * A decider that answers from the Resolutions the model already wrote and never calls the model: for a re-run after
 * a deletion, every earlier decision whose two sides survive is kept, and new unsure pairs go to review.
 */
export function rememberedDecisions(data) {
  const decide = async (pairs) =>
    pairs.map((p) => {
      const prior = data.getObject('Resolution', resolutionIdFor(p.type, p.a.__primaryKey, p.b.__primaryKey));
      if (!prior || prior.decidedBy !== 'local-model') return null;
      return { same: prior.decision === 'same', confidence: prior.confidence ?? p.score, reason: prior.reason ?? 'kept from an earlier decision' };
    });
  decide.remembered = true;
  return decide;
}

function pickTitle(rule, members) {
  // The most complete, best-looking spelling: most full words, then mixed case over SHOUTING, then "First Last"
  // over "LAST, FIRST", then the one seen most often.
  const titles = members.map((m) => String(m[rule.name] ?? '').trim()).filter(Boolean);
  const counts = new Map();
  for (const t of titles) counts.set(t, (counts.get(t) ?? 0) + 1);
  const score = (t) => {
    const words = rule.tokens(t).filter((w) => w.length > 1).length;
    const mixedCase = t !== t.toUpperCase() && t !== t.toLowerCase() ? 1 : 0;
    const noComma = t.includes(',') ? 0 : 1;
    return words * 100 + mixedCase * 10 + noComma * 5 + Math.min(counts.get(t), 4);
  };
  return titles.sort((x, y) => score(y) - score(x))[0] ?? String(members[0].__primaryKey);
}

function canonicalFor(meta, type, members, scenario) {
  const rule = TYPE_RULES[type];
  const pks = members.map((m) => String(m.__primaryKey)).sort();
  const pk = `${ID_PREFIX[type] ?? type}-${createHash('sha1').update(`${type}|${pks.join('|')}`).digest('hex').slice(0, 8)}`;
  const props = {};
  const def = meta.objectTypes[type].objectType;
  for (const name of Object.keys(def.properties)) {
    if (['canonicalId', 'passageId', 'recordId'].includes(name) || name === def.primaryKey) continue;
    const first = members.map((m) => m[name]).find((v) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0));
    if (first !== undefined) props[name] = first;
  }
  props[def.primaryKey] = pk;
  props[rule.name] = pickTitle(rule, members);
  props.scenario = scenario;
  if ('aliases' in def.properties) {
    const seen = new Set([props[rule.name]]);
    const aliases = [];
    for (const m of members) {
      for (const v of [m[rule.name], ...(Array.isArray(m.aliases) ? m.aliases : [])]) {
        const s = String(v ?? '').trim();
        if (s && !seen.has(s)) {
          seen.add(s);
          aliases.push(s);
        }
      }
    }
    props.aliases = aliases;
  }
  return toServerObject(meta, type, props);
}

/**
 * @param {object} args
 * @param {{ data: any, put(objs: object[]): void }} args.engine
 * @param {object} args.meta
 * @param {{ audit(e: object): void }} args.store
 * @param {string} args.scenario
 * @param {null | ((pairs: Array<{type, a, b, score, reasons}>) => Promise<Array<{ same: boolean, confidence: number, reason: string } | null>>)} args.decide
 *   the model's call for the 0.5 to 0.9 band; null (model off) leaves those pairs for review
 * @param {string[]} [args.types]
 */
export async function resolveScenario({ engine, meta, store, scenario, decide = null, types = ENTITY_TYPES }) {
  const data = engine.data;
  const now = new Date().toISOString();
  const summary = {};
  const canonicalOf = new Map(); // "Type:pk" of a mention -> canonical pk
  const toPut = [];

  for (const type of types) {
    if (!meta.objectTypes[type] || !TYPE_RULES[type]) continue;
    const all = [...data.getObjectsOfType(type)].filter((o) => !scenario || o.scenario === scenario);
    const mentions = all.filter(isMention);
    if (mentions.length === 0) continue;

    const pairs = candidatePairs(type, mentions);
    const uf = new UnionFind();
    for (const m of mentions) uf.find(String(m.__primaryKey));
    const resolutions = [];
    const autoPairs = pairs.filter((p) => p.score >= AUTO);
    const bandPairs = pairs.filter((p) => p.score < AUTO);

    for (const p of autoPairs) {
      uf.union(String(p.a.__primaryKey), String(p.b.__primaryKey));
      resolutions.push({ pair: p, decision: 'same', confidence: p.score, decidedBy: 'rule', method: 'rule: ' + p.reasons.join('; ') });
    }
    let modelPairs = 0;
    let reviewPairs = 0;
    if (bandPairs.length) {
      const verdicts = decide ? await decide(bandPairs.map((p) => ({ type, ...p }))) : bandPairs.map(() => null);
      bandPairs.forEach((p, i) => {
        const v = verdicts[i];
        if (v && v.same) {
          uf.union(String(p.a.__primaryKey), String(p.b.__primaryKey));
          resolutions.push({ pair: p, decision: 'same', confidence: v.confidence ?? p.score, decidedBy: 'local-model', method: `local-model; rule score ${p.score}: ${p.reasons.join('; ')}`, reason: v.reason });
          modelPairs++;
        } else if (v) {
          resolutions.push({ pair: p, decision: 'different', confidence: v.confidence ?? p.score, decidedBy: 'local-model', method: `local-model; rule score ${p.score}: ${p.reasons.join('; ')}`, reason: v.reason });
          modelPairs++;
        } else {
          resolutions.push({ pair: p, decision: 'review', confidence: p.score, decidedBy: 'pending', method: `rule score ${p.score}: ${p.reasons.join('; ')}`, reason: 'between 0.5 and 0.9; the local model has not decided yet' });
          reviewPairs++;
        }
      });
    }

    // Clusters -> canonical objects
    const clusters = new Map();
    for (const m of mentions) {
      const root = uf.find(String(m.__primaryKey));
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root).push(m);
    }
    const previousCanonicals = new Set(all.filter(isCanonical).map((o) => String(o.__primaryKey)));
    let canonicalCount = 0;
    for (const members of clusters.values()) {
      if (members.length < 2) {
        if (members[0].canonicalId) toPut.push({ ...members[0], canonicalId: undefined });
        continue;
      }
      const canonical = canonicalFor(meta, type, members, scenario);
      canonicalCount++;
      previousCanonicals.delete(String(canonical.__primaryKey));
      toPut.push(canonical);
      for (const m of members) {
        canonicalOf.set(`${type}:${m.__primaryKey}`, canonical.__primaryKey);
        if (m.canonicalId !== canonical.__primaryKey) toPut.push({ ...m, canonicalId: canonical.__primaryKey });
      }
      for (const r of resolutions) {
        const inCluster = members.some((m) => m.__primaryKey === r.pair.a.__primaryKey);
        if (inCluster && r.decision === 'same') r.canonicalId = canonical.__primaryKey;
      }
    }
    // A canonical object whose cluster dissolved (re-run on changed data) is removed: it is derived, not source.
    for (const stale of previousCanonicals) engine.remove(type, stale);

    // Resolution rows, one per decided pair, deterministic ids so a re-run overwrites rather than duplicates.
    for (const r of resolutions) {
      const [x, y] = [String(r.pair.a.__primaryKey), String(r.pair.b.__primaryKey)].sort();
      const resolutionId = resolutionIdFor(type, x, y);
      toPut.push(
        toServerObject(meta, 'Resolution', {
          resolutionId,
          label: `${r.pair.a[TYPE_RULES[type].name]} ${r.decision === 'same' ? 'is' : r.decision === 'different' ? 'is not' : 'may be'} ${r.pair.b[TYPE_RULES[type].name]}`,
          candidateIds: [`${type}:${x}`, `${type}:${y}`],
          canonicalType: type,
          canonicalId: r.canonicalId ?? '',
          decision: r.decision,
          confidence: r.confidence,
          decidedBy: r.decidedBy,
          method: r.method,
          decidedAt: now,
          reason: r.reason ?? r.pair.reasons.join('; '),
          scenario,
        }),
      );
    }

    summary[type] = { mentions: mentions.length, pairs: pairs.length, autoPairs: autoPairs.length, modelPairs, reviewPairs, clusters: clusters.size, canonical: canonicalCount };
  }

  // Relationships: foreign keys follow the canonical object; fromId / toId stay as extracted.
  let repointed = 0;
  for (const rel of data.getObjectsOfType('Relationship')) {
    if (scenario && rel.scenario && rel.scenario !== scenario) continue;
    const next = { ...rel };
    let changed = false;
    for (const end of ['from', 'to']) {
      const type = rel[`${end}Type`];
      const id = rel[`${end}Id`];
      if (!type || !id) continue;
      const key = `${end}${type}Id`;
      const target = canonicalOf.get(`${type}:${id}`) ?? id;
      if (next[key] !== target) {
        next[key] = target;
        changed = true;
      }
    }
    if (changed) {
      toPut.push(next);
      repointed++;
    }
  }

  if (toPut.length) engine.put(toPut.map((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))));
  store.audit({
    action: 'resolve',
    actor: decide && !decide.remembered ? 'engine+local-model' : 'engine',
    outcome: 'applied',
    params: { scenario, types: Object.keys(summary) },
    edits: [],
    objectIds: toPut.map((o) => `${o.__apiName}:${o.__primaryKey}`),
  });

  // Then the cross-type question: which canonical person owns each ownerless account.
  const owners = types.includes('DigitalAccount') && types.includes('Person') ? await resolveOwners({ engine, meta, store, scenario, decide }) : null;
  return { scenario, summary, owners, repointedRelationships: repointed, written: toPut.length };
}
