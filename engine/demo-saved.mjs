// The saved items a demo pack opens with (pnpm seed:saved <investigation> [--engine <url>], engine-api.md 2.10):
// data/<investigation>/saved.json names them by what they show, not by id, so the same file works on any engine
// after the pack is imported and resolved. Each name is resolved over the data layer to the object the graph has one
// node for (the canonical object, or a lone mention; never a mention that points at a canonical), the body Builder 3
// specified is built, and the item is created at the top level of the investigation, or updated when one of that
// kind and name is already there, or left alone when its body is the same. A name that does not resolve leaves its
// item out and says why. Idempotent: run it after every resolution and the items follow the canonical ids.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from '../src/data/client.ts';
import { fetchRows } from '../src/data/reads.ts';
import { startExploration, withStep } from '../src/data/exploration.ts';
import { createSaved, getInvestigations, getSaved, listSaved, updateSaved } from '../src/data/intake.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Case, accents and spacing set aside, so "DELA PENA, JOAQUIN" is not a different person from "Dela Peña, Joaquin". */
export const plain = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const isMention = (row) => !!(row.properties.passageId || row.properties.recordId);
const pointsAtCanonical = (row) => !!row.properties.canonicalId;
const describe = (target) => (target.only ? `the only ${target.type}` : `${target.type} "${target.name}"`);

/** Every object of one type in the investigation that the graph would show as its own node. */
async function nodesOf(dc, investigation, type) {
  if (!dc.catalog.types[type]) throw new Error(`no object type ${type}`);
  const exp = withStep(startExploration(type, 200), { filter: { property: 'scenario', op: 'eq', value: investigation } });
  const rows = [];
  let token;
  do {
    const page = await fetchRows(dc, exp, token);
    rows.push(...page.rows);
    token = page.nextPageToken;
  } while (token);
  return rows.filter((r) => !pointsAtCanonical(r));
}

/**
 * One target to one `Type:pk`, or a reason it cannot be. By name: the exact title first (a canonical object before a
 * lone mention), then an alias, then the one object whose title contains the name. `only: true`: the single object
 * of that type.
 */
export async function resolveTarget(dc, investigation, target) {
  const nodes = await nodesOf(dc, investigation, target.type);
  const pick = (row) => ({ id: `${target.type}:${row.pk}`, title: row.title });
  if (target.only) {
    if (nodes.length === 1) return pick(nodes[0]);
    return { why: nodes.length === 0 ? `no ${target.type} in ${investigation}` : `${nodes.length} ${target.type} objects in ${investigation}, so "only" picks none` };
  }
  const wanted = plain(target.name);
  if (!wanted) return { why: `${target.type} target has no name` };
  const byTitle = nodes.filter((r) => plain(r.title) === wanted);
  if (byTitle.length) return pick(byTitle.find((r) => !isMention(r)) ?? byTitle[0]);
  const byAlias = nodes.filter((r) => (Array.isArray(r.properties.aliases) ? r.properties.aliases : []).some((a) => plain(a) === wanted));
  if (byAlias.length === 1) return pick(byAlias[0]);
  if (byAlias.length > 1) return { why: `${describe(target)} is an alias of ${byAlias.length} objects` };
  const within = nodes.filter((r) => plain(r.title).includes(wanted));
  if (within.length === 1) return pick(within[0]);
  if (within.length > 1) return { why: `${describe(target)} is part of ${within.length} titles: ${within.map((r) => `"${r.title}"`).join(', ')}` };
  return { why: `${describe(target)} is not in ${investigation}` };
}

/** The body of one item with every target resolved, or `{ why }` naming the first target that is not there. */
export async function buildBody(dc, investigation, item) {
  if (item.kind === 'graph') {
    const focus = await resolveTarget(dc, investigation, item.focus);
    if (focus.why) return { why: `focus: ${focus.why}` };
    let to = null;
    const resolved = [focus.title];
    if (item.to) {
      const r = await resolveTarget(dc, investigation, item.to);
      if (r.why) return { why: `to: ${r.why}` };
      to = r.id;
      resolved.push(r.title);
    }
    return { body: { nodes: [], focus: focus.id, to }, resolved };
  }
  if (item.kind === 'timeline') {
    const subjects = [];
    for (const target of item.subjects ?? []) {
      const r = await resolveTarget(dc, investigation, target);
      if (r.why) return { why: `subject: ${r.why}` };
      subjects.push(r.id);
    }
    if (!subjects.length) return { why: 'a timeline needs at least one subject' };
    return { body: { subjects, hops: item.hops ?? 1, from: item.from ?? null, until: item.until ?? null }, resolved: subjects };
  }
  return { why: `kind ${item.kind} has no demo shape` };
}

/** The same JSON whatever the key order, so "already right" is a fact and not an accident of ordering. */
const stable = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

export function readPackSaved(investigation) {
  const path = join(root, 'data', investigation, 'saved.json');
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(parsed.items)) throw new Error(`${path} has no items list`);
  return parsed.items;
}

/**
 * @returns {{ investigation, created: object[], updated: object[], unchanged: object[], skipped: Array<{ kind, name, why }> }}
 */
export async function seedSaved({ investigation, engine = 'http://localhost:8787', items = readPackSaved(investigation), log = console.log }) {
  const dc = await connect(engine);
  const { investigations } = await getInvestigations(dc);
  if (!investigations.some((i) => i.id === investigation)) throw new Error(`the engine at ${engine} holds no investigation ${investigation}`);
  const result = { investigation, created: [], updated: [], unchanged: [], skipped: [] };
  const existing = (await listSaved(dc, investigation)).items;
  for (const item of items) {
    const built = await buildBody(dc, investigation, item);
    if (built.why) {
      result.skipped.push({ kind: item.kind, name: item.name, why: built.why });
      log(`left out ${item.kind} "${item.name}": ${built.why}`);
      continue;
    }
    const found = existing.find((s) => s.kind === item.kind && s.name === item.name);
    if (!found) {
      const made = await createSaved(dc, { investigation, kind: item.kind, name: item.name, body: built.body });
      result.created.push({ id: made.id, kind: item.kind, name: item.name, body: built.body });
      log(`created ${item.kind} "${item.name}" (${made.id}): ${built.resolved.join(', ')}`);
      continue;
    }
    const current = await getSaved(dc, found.id);
    if (stable(current.body ?? {}) === stable(built.body)) {
      result.unchanged.push({ id: found.id, kind: item.kind, name: item.name });
      log(`kept ${item.kind} "${item.name}" (${found.id}), already right`);
      continue;
    }
    await updateSaved(dc, found.id, { body: built.body });
    result.updated.push({ id: found.id, kind: item.kind, name: item.name, body: built.body });
    log(`updated ${item.kind} "${item.name}" (${found.id}): ${built.resolved.join(', ')}`);
  }
  return result;
}

function parseArgs(argv) {
  const args = { investigation: '', engine: process.env.BARGHEST_ENGINE_URL ?? 'http://localhost:8787' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--engine') args.engine = argv[++i] ?? '';
    else if (!a.startsWith('--') && !args.investigation) args.investigation = a;
    else throw new Error(`unknown argument ${a}`);
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.investigation) {
    console.error('usage: pnpm seed:saved <investigation> [--engine <url>]');
    process.exit(2);
  }
  seedSaved(args)
    .then((r) => {
      console.log(`done: ${r.created.length} created, ${r.updated.length} updated, ${r.unchanged.length} kept, ${r.skipped.length} left out`);
      process.exit(0);
    })
    .catch((e) => {
      console.error(`seed:saved failed: ${e?.message ?? e}`);
      process.exit(1);
    });
}
