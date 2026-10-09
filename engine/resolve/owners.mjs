// Who owns an account: a DigitalAccount with no owner is matched against the canonical people of its scenario by
// its display name and handle. A full name in the display name is a rule decision; a first name plus initials
// ("Joaquin DP" against Joaquin Dela Peña) or a handle that carries a person's alias goes to the local model.
// On "same" the account gets its personId and a Resolution records how. The account itself is never merged.
import { createHash } from 'node:crypto';
import { toServerObject } from '../faux.mjs';
import { handleKey, nameTokens, stripDiacritics } from './normalize.mjs';
import { AUTO, REVIEW } from './pairs.mjs';

const isCanonicalPerson = (p) => !p.canonicalId && (p.__apiName === 'Person');

/** Score one account against one person; null when nothing connects them. */
export function scoreOwner(account, person) {
  const name = nameTokens(person.fullName);
  if (name.length === 0) return null;
  const words = name.filter((t) => t.length > 1);
  const aliases = (Array.isArray(person.aliases) ? person.aliases : []).map((a) => nameTokens(a).join(' ')).filter(Boolean);
  const display = nameTokens(account.displayName ?? '');
  const handle = handleKey(account.handle ?? '');
  const reasons = [];
  let score = 0;

  if (display.length) {
    // The display name's tokens that are the person's words, and the rest ("DP", or "D." "P.").
    const known = display.filter((t) => words.includes(t));
    const extra = display.filter((t) => !words.includes(t));
    if (known.length >= 2 && extra.length === 0) {
      reasons.push(`display name "${account.displayName}" is the person's name`);
      score = Math.max(score, 0.95);
    } else if (known.length >= 1) {
      const rest = words.filter((t) => !known.includes(t));
      const joinedInitials = rest.map((w) => w[0]).join('');
      const fits =
        extra.length > 0 &&
        rest.length > 0 &&
        (extra.join('') === joinedInitials || (extra.every((t) => t.length === 1) && extra.length === rest.length && extra.every((i, k) => rest[k]?.startsWith(i))));
      if (fits) {
        reasons.push(`display name "${account.displayName}" is the first name plus the initials of the rest`);
        score = Math.max(score, 0.75);
      } else if (extra.length === 0 && known.length === 1 && words[0] === known[0]) {
        reasons.push('display name is the first name only');
        score = Math.max(score, 0.5);
      }
    }
  }

  if (handle) {
    const flat = stripDiacritics(handle).replace(/[^a-z0-9]/g, '');
    const fullFlat = words.join('');
    if (flat.includes(fullFlat) && fullFlat.length >= 6) {
      reasons.push(`handle "${account.handle}" contains the full name`);
      score = Math.max(score, 0.95);
    } else {
      for (const a of aliases) {
        const aFlat = a.replace(/[^a-z0-9]/g, '');
        if (aFlat.length >= 4 && flat.includes(aFlat)) {
          reasons.push(`handle "${account.handle}" carries the alias "${a}"`);
          score = Math.max(score, 0.62);
        }
      }
      const first = words[0];
      if (first && first.length >= 4 && flat.includes(first) && score < 0.5) {
        reasons.push(`handle "${account.handle}" contains the first name`);
        score = Math.max(score, 0.5);
      }
    }
  }

  return score >= REVIEW ? { score: Math.round(score * 100) / 100, reasons } : null;
}

/** Match ownerless accounts of a scenario to its canonical people. Returns what was written. */
export async function resolveOwners({ engine, meta, store, scenario, decide = null }) {
  const data = engine.data;
  const people = [...data.getObjectsOfType('Person')].filter((p) => isCanonicalPerson(p) && (!scenario || p.scenario === scenario));
  const accounts = [...data.getObjectsOfType('DigitalAccount')].filter((a) => !a.personId && !a.canonicalId && (!scenario || a.scenario === scenario));
  const candidates = [];
  for (const account of accounts) {
    let best = null;
    for (const person of people) {
      const s = scoreOwner(account, person);
      if (s && (!best || s.score > best.score)) best = { account, person, ...s };
    }
    if (best) candidates.push(best);
  }

  const now = new Date().toISOString();
  const toPut = [];
  const summary = { accounts: accounts.length, candidates: candidates.length, autoPairs: 0, modelPairs: 0, reviewPairs: 0, owned: 0 };
  const auto = candidates.filter((c) => c.score >= AUTO);
  const band = candidates.filter((c) => c.score < AUTO);
  const verdicts = band.length && decide ? await decide(band.map((c) => ({ type: 'DigitalAccount owner', a: c.account, b: c.person, score: c.score, reasons: c.reasons, question: 'Does account A belong to person B?' }))) : band.map(() => null);

  const write = (c, decision, confidence, decidedBy, reason) => {
    const resolutionId = `RS-${createHash('sha1').update(`owner|${c.account.__primaryKey}|${c.person.__primaryKey}`).digest('hex').slice(0, 8)}`;
    if (decision === 'same') {
      toPut.push({ ...c.account, personId: c.person.__primaryKey });
      summary.owned++;
    }
    toPut.push(
      toServerObject(meta, 'Resolution', {
        resolutionId,
        label: `${c.account.handle ?? c.account.__primaryKey} ${decision === 'same' ? 'belongs to' : decision === 'different' ? 'does not belong to' : 'may belong to'} ${c.person.fullName}`,
        candidateIds: [`DigitalAccount:${c.account.__primaryKey}`],
        canonicalType: 'Person',
        canonicalId: decision === 'same' ? String(c.person.__primaryKey) : '',
        decision,
        confidence,
        decidedBy,
        method: `${decidedBy === 'rule' ? 'rule' : decidedBy === 'local-model' ? 'local-model; rule score ' + c.score : 'rule score ' + c.score}: ${c.reasons.join('; ')}`,
        decidedAt: now,
        reason,
        scenario,
      }),
    );
  };

  for (const c of auto) {
    write(c, 'same', c.score, 'rule', c.reasons.join('; '));
    summary.autoPairs++;
  }
  band.forEach((c, i) => {
    const v = verdicts[i];
    if (v) {
      write(c, v.same ? 'same' : 'different', v.confidence ?? c.score, 'local-model', v.reason);
      summary.modelPairs++;
    } else {
      write(c, 'review', c.score, 'pending', 'between 0.5 and 0.9; the local model has not decided yet');
      summary.reviewPairs++;
    }
  });

  if (toPut.length) engine.put(toPut);
  if (candidates.length) {
    store.audit({
      action: 'resolveOwners',
      actor: decide ? 'engine+local-model' : 'engine',
      outcome: 'applied',
      params: { scenario, ...summary },
      edits: [],
      objectIds: toPut.map((o) => `${o.__apiName}:${o.__primaryKey}`),
    });
  }
  return summary;
}
