// The canvas as data: which objects are on it and where (their icon's centre), packed small enough for the address
// bar, so Back, refresh and a pasted link land on the same graph. Edges are never stored; they are drawn fresh from
// each object's view. Plus the hand-made layout: the focus in the middle, neighbours on a ring, every later expansion
// fanned outward from its parent, away from the middle.
import type { Catalog, LinkGroup, ObjectView, RelationshipView } from '../data/index.ts';
import { objectKey } from './icons';

export interface CanvasNode {
  key: string;
  type: string;
  pk: string;
  /** the centre of the node's icon, in canvas coordinates */
  x: number;
  y: number;
}

/** Width of a node (its label wraps inside it) and the icon tile on top, Gotham's size. Mirrored in graph.css. */
export const NODE_W = 160;
export const ICON_BOX = 40;

// Evidence and resolution plumbing are never nodes (engine-api, what-connects); neither are the links that lead to
// the same real thing (candidates, canonical) or to the Relationship objects, which become edges instead.
const EVIDENCE_TYPES = new Set(['Document', 'Passage', 'SourceRecord', 'Resolution', 'Relationship']);
const SKIP_LINKS = new Set(['candidates', 'canonical', 'passage', 'sourceRecord', 'document', 'passages', 'records', 'relationshipsFrom', 'relationshipsTo']);

export function isGraphType(type: string): boolean {
  return !EVIDENCE_TYPES.has(type);
}

/** The links of an object that lead to other things: what Search around offers. */
export function graphLinks(view: ObjectView): LinkGroup[] {
  return view.links.filter((g) => !SKIP_LINKS.has(g.link) && isGraphType(g.targetType));
}

export function relationshipsOf(view: ObjectView): RelationshipView[] {
  return [...view.relationships.out, ...view.relationships.in];
}

/** "groomed_by" as people say it. */
export function kindText(kind: string): string {
  return kind.replace(/_/g, ' ');
}

// ---- The address bar ----

function toBase64Url(s: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

export function encodeNodes(nodes: CanvasNode[]): string {
  return toBase64Url(JSON.stringify(nodesToRows(nodes)));
}

/** Null for a missing or unreadable value, so a broken link opens an empty canvas instead of failing. */
export function decodeNodes(encoded: string | null): CanvasNode[] | null {
  if (!encoded) return null;
  try {
    return rowsToNodes(JSON.parse(fromBase64Url(encoded)));
  } catch {
    return null;
  }
}

/** The canvas as a saved graph keeps it: [type, pk, x, y] per object. */
export function nodesToRows(nodes: CanvasNode[]): Array<[string, string, number, number]> {
  return nodes.map((n) => [n.type, n.pk, Math.round(n.x), Math.round(n.y)]);
}

/** Rows back to the canvas, leaving out anything unreadable; null when it isn't a list at all. */
export function rowsToNodes(rows: unknown): CanvasNode[] | null {
  if (!Array.isArray(rows)) return null;
  return rows
    .filter((r): r is [string, string, number, number] => Array.isArray(r) && typeof r[0] === 'string' && typeof r[1] === 'string' && Number.isFinite(r[2]) && Number.isFinite(r[3]))
    .map(([type, pk, x, y]) => ({ key: objectKey(type, pk), type, pk, x, y }));
}

// ---- Layout ----

interface Point {
  x: number;
  y: number;
}

const RING = 220;
const SPACING = 140;
const CLEARANCE = 120;

/**
 * Where `count` new nodes go around `parent`. With no `away` point (the first expansion, or the focus itself) they
 * make a full ring; otherwise an arc facing away from `away`, the middle of the graph. Each spot is pushed outward
 * until it clears every node already placed.
 */
export function placeAround(parent: Point, count: number, taken: Point[], away: Point | null): Point[] {
  if (!count) return [];
  const facing = away && (away.x !== parent.x || away.y !== parent.y) ? Math.atan2(parent.y - away.y, parent.x - away.x) : null;
  const spread = facing == null ? Math.PI * 2 : Math.min(Math.PI * 1.25, Math.max(Math.PI / 3, count * 0.45));
  const radius = Math.max(RING, (SPACING * count) / spread);
  const placed: Point[] = [];
  for (let i = 0; i < count; i++) {
    const angle = facing == null ? -Math.PI / 2 + (i * Math.PI * 2) / count : facing - spread / 2 + (count === 1 ? spread / 2 : (i * spread) / (count - 1));
    let r = radius;
    let spot = { x: parent.x + Math.cos(angle) * r, y: parent.y + Math.sin(angle) * r };
    for (let tries = 0; tries < 12 && [...taken, ...placed].some((p) => Math.hypot(p.x - spot.x, p.y - spot.y) < CLEARANCE); tries++) {
      r += CLEARANCE / 2;
      spot = { x: parent.x + Math.cos(angle) * r, y: parent.y + Math.sin(angle) * r };
    }
    placed.push(spot);
  }
  return placed;
}

/** Layout ▸ Ring: the focus (or the first object) in the middle, everything else on one ring around it. */
export function ringLayout(nodes: CanvasNode[], focus: string | null): CanvasNode[] {
  if (nodes.length < 2) return nodes;
  const mid = nodes.find((n) => n.key === focus) ?? nodes[0];
  const centre = { x: mid.x, y: mid.y };
  const others = nodes.filter((n) => n !== mid);
  const r = Math.max(RING, (SPACING * others.length) / (Math.PI * 2));
  return [mid, ...others.map((n, i) => ({ ...n, x: centre.x + Math.cos(-Math.PI / 2 + (i * Math.PI * 2) / others.length) * r, y: centre.y + Math.sin(-Math.PI / 2 + (i * Math.PI * 2) / others.length) * r }))];
}

/** Layout ▸ Grid: rows of objects grouped by type, from the top left of where the graph is now. */
export function gridLayout(nodes: CanvasNode[]): CanvasNode[] {
  if (!nodes.length) return nodes;
  const sorted = [...nodes].sort((a, b) => a.type.localeCompare(b.type) || a.key.localeCompare(b.key));
  const cols = Math.ceil(Math.sqrt(sorted.length * 1.6));
  const x0 = Math.min(...nodes.map((n) => n.x));
  const y0 = Math.min(...nodes.map((n) => n.y));
  return sorted.map((n, i) => ({ ...n, x: x0 + (i % cols) * 190, y: y0 + Math.floor(i / cols) * 110 }));
}

/** The middle of the graph: the focus when it is on the canvas, else the centre of everything. */
export function middleOf(nodes: CanvasNode[], focus: string | null): Point | null {
  const f = focus ? nodes.find((n) => n.key === focus) : undefined;
  if (f) return f;
  if (!nodes.length) return null;
  return { x: nodes.reduce((s, n) => s + n.x, 0) / nodes.length, y: nodes.reduce((s, n) => s + n.y, 0) / nodes.length };
}

// ---- Edges ----

export interface EdgeModel {
  id: string;
  source: string;
  target: string;
  label: string;
  /** under 0.9 confidence, or in review */
  dashed: boolean;
  /** a Relationship object (with its evidence), or a plain link of the ontology */
  relationship: RelationshipView | null;
  link: string | null;
  /** the bend, so parallel edges between the same two objects don't overlap */
  offset: number;
}

/** Two objects as an unordered pair, for parallel edges and lit paths. */
export const pairOf = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function isDashed(r: { confidence: number | null; status: string }): boolean {
  return (r.confidence != null && r.confidence < 0.9) || r.status === 'review';
}

export function relationshipLabel(r: { kind: string; confidence: number | null; status: string }): string {
  return [kindText(r.kind), r.confidence != null ? r.confidence.toFixed(2) : null, r.status === 'review' ? 'in review' : null].filter(Boolean).join(' · ');
}

/** A link between two objects on the canvas that only a path step names (a path may walk a link the views skip). */
export interface StepLink {
  from: string;
  link: string;
  to: string;
}

/**
 * Every edge between two objects on the canvas, from the views loaded so far: each Relationship once, and each
 * ontology link once, named from its single-valued side ("hollow.ix, Owner, Joaquin") when that side is loaded, so
 * a link and its reverse never both appear.
 */
/**
 * Every mention merged into another object, as mention key to canonical key. The graph has one node per real thing
 * (engine-api.md, P6), so a mention folds into its canonical object and a link to it lands there too.
 */
export function foldsOf(views: Map<string, ObjectView>, steps: StepLink[] = []): Map<string, string> {
  const folds = new Map<string, string>();
  // A path that steps from an object to one of its candidates, or from a mention to its canonical object, says so itself.
  for (const s of steps) {
    if (s.link === 'candidates') folds.set(s.to, s.from);
    if (s.link === 'canonical') folds.set(s.from, s.to);
  }
  for (const [key, v] of views) if (v.canonical && v.canonical.pk !== v.pk) folds.set(key, objectKey(v.type, v.canonical.pk));
  return folds;
}

export function deriveEdges(nodes: CanvasNode[], views: Map<string, ObjectView>, catalog: Catalog, steps: StepLink[]): EdgeModel[] {
  const onCanvas = new Set(nodes.map((n) => n.key));
  const folds = foldsOf(views, steps);
  const fold = (k: string) => folds.get(k) ?? k;
  const edges = new Map<string, EdgeModel>();
  const linkSide = new Map<string, string>();

  for (const n of nodes) {
    const view = views.get(n.key);
    if (!view) continue;
    for (const [list, out] of [
      [view.relationships.out, true],
      [view.relationships.in, false],
    ] as const) {
      for (const r of list) {
        const other = fold(objectKey(r.otherType, r.otherPk));
        if (other === n.key || !onCanvas.has(other) || edges.has(`rel:${r.pk}`)) continue;
        edges.set(`rel:${r.pk}`, {
          id: `rel:${r.pk}`,
          source: out ? n.key : other,
          target: out ? other : n.key,
          label: relationshipLabel(r),
          dashed: isDashed(r),
          relationship: r,
          link: null,
          offset: 0,
        });
      }
    }
  }

  const addLink = (from: string, link: string, displayName: string, to: string) => {
    if (from === to || !onCanvas.has(to)) return;
    const pair = pairOf(from, to);
    const side = linkSide.get(pair);
    if (side && side !== from) return;
    linkSide.set(pair, from);
    const id = `link:${from}>${link}>${to}`;
    if (!edges.has(id)) edges.set(id, { id, source: from, target: to, label: displayName, dashed: false, relationship: null, link, offset: 0 });
  };
  // Single-valued links first, so a pair is named from that side whenever it is loaded.
  for (const card of ['one', 'many'] as const) {
    for (const n of nodes) {
      const view = views.get(n.key);
      if (!view) continue;
      for (const g of graphLinks(view)) {
        if (catalog.types[n.type]?.links.find((l) => l.apiName === g.link)?.cardinality !== card) continue;
        for (const t of g.first) addLink(n.key, g.link, g.displayName, fold(objectKey(g.targetType, t.pk)));
      }
    }
  }
  for (const s of steps) {
    const from = fold(s.from);
    if (!onCanvas.has(from) || from.startsWith('Relationship:') || s.to.startsWith('Relationship:')) continue;
    const type = from.slice(0, from.indexOf(':'));
    addLink(from, s.link, catalog.types[type]?.links.find((l) => l.apiName === s.link)?.displayName ?? s.link, fold(s.to));
  }

  // Parallel edges between one pair bend apart, each the same way whichever end it starts from.
  const byPair = new Map<string, EdgeModel[]>();
  for (const e of edges.values()) {
    const pair = pairOf(e.source, e.target);
    byPair.set(pair, [...(byPair.get(pair) ?? []), e]);
  }
  for (const group of byPair.values()) {
    if (group.length < 2) continue;
    group.forEach((e, i) => {
      const bend = (i - (group.length - 1) / 2) * 48;
      e.offset = e.source < e.target ? bend : -bend;
    });
  }
  return [...edges.values()];
}
