// Gotham's helpers beside the canvas (G-Cloud 14 service definition, page 12), the three the engine can back:
// Histogram (object types, link types and property values over what's on the canvas, a click picks those objects),
// Selection ("a miniature version of the Browser") and the paths between two objects. Plus Find path to… and the empty
// canvas.
import { Button, Callout, Classes, Dialog, DialogBody, H5, H6, InputGroup, NonIdealState, ProgressBar, Spinner } from '@blueprintjs/core';
import { CaretDown, CaretRight, Document, Search } from '@blueprintjs/icons';
import { useState, type ReactNode } from 'react';
import type { AsyncState, Catalog, ObjectView } from '../data/index.ts';
import { formatCount } from '../explorer/parts';
import { showValue } from '../explorer/steps';
import type { WhatConnectsResult } from './bridge';
import { kindText, type CanvasNode, type EdgeModel } from './canvas';
import { typeIcon } from './icons';
import { SearchResults, type Found } from './search';

export type Picked = { kind: 'node'; key: string } | { kind: 'edge'; id: string };

function Heading({ children, end }: { children: string; end?: ReactNode }) {
  return (
    <div className="graph-helper__row">
      <H6 className={`caps-heading ${Classes.TEXT_MUTED}`}>{children}</H6>
      {end}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className={Classes.TEXT_MUTED}>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

// ---- Histogram ----

interface Bucket {
  key: string;
  label: string;
  icon?: ReactNode;
  /** the objects a click picks */
  keys: string[];
  /** what the row counts, when it isn't its objects (a link type counts its links) */
  count?: number;
}

/** "3" with nothing picked, "1/3" when some of the bucket is picked, as Gotham counts against the selection. */
function countText(keys: string[], selected: Set<string>, count?: number): string {
  if (count != null) return formatCount(count);
  if (!selected.size) return formatCount(keys.length);
  return `${formatCount(keys.filter((k) => selected.has(k)).length)}/${formatCount(keys.length)}`;
}

function BucketRow({ bucket, max, selected, onPick }: { bucket: Bucket; max: number; selected: Set<string>; onPick: (keys: string[]) => void }) {
  const all = bucket.keys.length > 0 && bucket.keys.every((k) => selected.has(k));
  return (
    <Button
      className={`graph-bucket${all ? ' graph-bucket--on' : ''}`}
      variant="minimal"
      alignText="start"
      fill
      aria-pressed={all}
      onClick={() => onPick(bucket.keys)}
      text={
        <span className="graph-bucket__cells">
          <span className="graph-bucket__icon">{bucket.icon}</span>
          <span className="graph-bucket__label">{bucket.label}</span>
          <span className={`graph-bucket__count ${Classes.TEXT_MUTED}`}>{countText(bucket.keys, selected, bucket.count)}</span>
          <span className="graph-bucket__bar" aria-hidden="true">
            <ProgressBar value={max ? (bucket.count ?? bucket.keys.length) / max : 0} animate={false} stripes={false} intent="primary" />
          </span>
        </span>
      }
    />
  );
}

function Group({ title, count, buckets, selected, onPick, open: startOpen = true, limit = 7 }: { title: string; count: number; buckets: Bucket[]; selected: Set<string>; onPick: (keys: string[]) => void; open?: boolean; limit?: number }) {
  // Open follows the default (the biggest group) until the analyst toggles it.
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? startOpen;
  const setOpen = (f: (o: boolean) => boolean) => setOverride(f(open));
  const [all, setAll] = useState(false);
  const max = Math.max(1, ...buckets.map((b) => b.count ?? b.keys.length));
  const shown = all ? buckets : buckets.slice(0, limit);
  return (
    <div className="graph-group">
      <Button
        className="graph-group__head"
        variant="minimal"
        alignText="start"
        fill
        icon={open ? <CaretDown /> : <CaretRight />}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        text={
          <span className="graph-group__cells">
            <span className="graph-group__title">{title}</span>
            <span className={Classes.TEXT_MUTED}>{formatCount(count)}</span>
          </span>
        }
      />
      {open && (
        <>
          {shown.map((b) => (
            <BucketRow key={b.key} bucket={b} max={max} selected={selected} onPick={onPick} />
          ))}
          {buckets.length > limit && <Button className="graph-group__more" variant="minimal" alignText="start" text={all ? 'Show fewer' : 'Show more…'} onClick={() => setAll((a) => !a)} />}
        </>
      )}
    </div>
  );
}

interface HistogramProps {
  catalog: Catalog;
  nodes: CanvasNode[];
  views: Map<string, ObjectView>;
  edges: EdgeModel[];
  selected: Set<string>;
  onPick: (keys: string[]) => void;
}

export function HistogramHelper({ catalog, nodes, views, edges, selected, onPick }: HistogramProps) {
  const byType = new Map<string, string[]>();
  for (const n of nodes) byType.set(n.type, [...(byType.get(n.type) ?? []), n.key]);
  const types: Bucket[] = [...byType]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([type, keys]) => {
      const Icon = typeIcon(type);
      return { key: type, label: catalog.types[type]?.displayName ?? type, icon: <Icon />, keys };
    });

  const byLink = new Map<string, Set<string>>();
  for (const e of edges) {
    const name = e.relationship ? kindText(e.relationship.kind) : e.label;
    const set = byLink.get(name) ?? new Set<string>();
    set.add(e.source);
    set.add(e.target);
    byLink.set(name, set);
  }
  const linkCounts = new Map<string, number>();
  for (const e of edges) {
    const name = e.relationship ? kindText(e.relationship.kind) : e.label;
    linkCounts.set(name, (linkCounts.get(name) ?? 0) + 1);
  }
  const links: Bucket[] = [...byLink]
    .sort((a, b) => (linkCounts.get(b[0]) ?? 0) - (linkCounts.get(a[0]) ?? 0) || a[0].localeCompare(b[0]))
    .map(([name, keys]) => ({ key: name, label: name, keys: [...keys], count: linkCounts.get(name) ?? 0 }));

  // Property values across the objects on the canvas: one group per property, a row per value.
  const props = new Map<string, Map<string, string[]>>();
  for (const n of nodes) {
    const view = views.get(n.key);
    const def = catalog.types[n.type];
    if (!view || !def) continue;
    const hidden = new Set(def.properties.filter((p) => p.hidden).map((p) => p.apiName));
    for (const p of view.properties) {
      // Keys and raw ids pointing at other objects say nothing on their own; the links show those.
      if (hidden.has(p.apiName) || p.apiName === def.titleProperty || p.apiName === def.primaryKey || p.apiName === 'scenario' || /Ids?$/.test(p.apiName)) continue;
      const value = showValue(p.value);
      if (!value) continue;
      const values = props.get(p.displayName) ?? new Map<string, string[]>();
      values.set(value, [...(values.get(value) ?? []), n.key]);
      props.set(p.displayName, values);
    }
  }
  const propGroups = [...props]
    .map(([name, values]) => ({ name, values, objects: new Set([...values.values()].flat()).size }))
    .sort((a, b) => b.objects - a.objects || a.name.localeCompare(b.name));

  return (
    <div className="graph-helper">
      <Heading>Object types</Heading>
      <Group title="Objects" count={nodes.length} buckets={types} selected={selected} onPick={onPick} />
      <Heading>Link types</Heading>
      {links.length ? <Group title="Links" count={edges.length} buckets={links} selected={selected} onPick={onPick} limit={5} /> : <p className={`${Classes.TEXT_MUTED} graph-helper__hint`}>No links between these objects yet.</p>}
      <Heading>Property values</Heading>
      {propGroups.length ? (
        propGroups.map((g, i) => (
          <Group
            key={g.name}
            title={g.name}
            count={g.values.size}
            open={i === 0}
            limit={5}
            selected={selected}
            onPick={onPick}
            buckets={[...g.values].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([value, keys]) => ({ key: value, label: value, keys }))}
          />
        ))
      ) : (
        <p className={`${Classes.TEXT_MUTED} graph-helper__hint`}>Values appear as each object's details load.</p>
      )}
    </div>
  );
}

// ---- Selection ----

interface SelectionProps {
  catalog: Catalog;
  picked: Picked | null;
  selectedCount: number;
  selectedTitles: string[];
  view: ObjectView | undefined;
  edge: EdgeModel | undefined;
  title: (key: string) => string;
  onOpenProfile: (key: string) => void;
  onAsk: (key: string) => void;
  onEvidence: (edge: EdgeModel) => void;
}

export function SelectionHelper({ catalog, picked, selectedCount, selectedTitles, view, edge, title, onOpenProfile, onAsk, onEvidence }: SelectionProps) {
  if (selectedCount > 1) {
    return (
      <div className="graph-helper">
        <Heading>{`${selectedCount} selected`}</Heading>
        <ul className="graph-selected">
          {selectedTitles.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (!picked) {
    return (
      <div className="graph-helper">
        <Heading>Selection</Heading>
        <p className={`${Classes.TEXT_MUTED} graph-helper__hint`}>Click an object or a link to see it here.</p>
      </div>
    );
  }
  if (picked.kind === 'edge') {
    if (!edge) return null;
    const r = edge.relationship;
    const passages = r?.passages.length ?? 0;
    return (
      <div className="graph-helper">
        <Heading>Selection</Heading>
        <H5 className="graph-helper__title">{r ? kindText(r.kind) : edge.label}</H5>
        <p className="graph-helper__ends">
          {title(edge.source)} <span className={Classes.TEXT_MUTED}>to</span> {title(edge.target)}
        </p>
        {r ? (
          <>
            <dl className="graph-facts">
              {r.confidence != null && <Fact label="Confidence" value={r.confidence.toFixed(2)} />}
              {r.status && <Fact label="Status" value={r.status} />}
              {r.method && <Fact label="Method" value={r.method} />}
              {r.observedAt && <Fact label="Observed" value={showValue(r.observedAt)} />}
            </dl>
            <Button icon={<Document />} text={passages ? `Show evidence (${passages})` : 'No passage cited'} disabled={!passages} alignText="start" fill onClick={() => onEvidence(edge)} />
          </>
        ) : (
          <p className={`${Classes.TEXT_MUTED} graph-helper__hint`}>A link in the ontology. It cites no passage of its own.</p>
        )}
      </div>
    );
  }
  const key = picked.key;
  const type = key.slice(0, key.indexOf(':'));
  const def = catalog.types[type];
  const Icon = typeIcon(type);
  const hidden = new Set(def?.properties.filter((p) => p.hidden).map((p) => p.apiName));
  const facts = view?.properties.filter((p) => !hidden.has(p.apiName) && p.apiName !== def?.titleProperty && p.apiName !== 'scenario' && showValue(p.value) !== '') ?? [];
  return (
    <div className="graph-helper">
      <Heading>Selection</Heading>
      <H5 className="graph-helper__title">
        <Icon /> {title(key)}
      </H5>
      <p className={`${Classes.TEXT_MUTED} graph-helper__type`}>{def?.displayName ?? type}</p>
      {!view ? (
        <Spinner size={20} />
      ) : (
        <dl className="graph-facts">
          {facts.map((p) => (
            <Fact key={p.apiName} label={p.displayName} value={showValue(p.value)} />
          ))}
        </dl>
      )}
      <div className="graph-helper__actions">
        <Button text="Open profile" alignText="start" fill onClick={() => onOpenProfile(key)} />
        <Button text="Ask in Assistant" alignText="start" fill onClick={() => onAsk(key)} />
      </div>
    </div>
  );
}

// ---- Paths ----

interface PathsProps {
  asked: boolean;
  paths: AsyncState<WhatConnectsResult>;
  lit: number | null;
  onLight: (i: number | null) => void;
  onClear: () => void;
  title: (key: string) => string;
  from: string | null;
  to: string | null;
}

export function PathsHelper({ asked, paths, lit, onLight, onClear, title, from, to }: PathsProps) {
  const data = paths.data;
  return (
    <div className="graph-helper">
      <Heading end={asked ? <Button variant="minimal" text="Clear" onClick={onClear} /> : undefined}>{data?.found ? `Paths · ${data.paths.length}` : 'Paths'}</Heading>
      {!asked || !from || !to ? (
        <p className={`${Classes.TEXT_MUTED} graph-helper__hint`}>Right-click an object and choose Find path to…</p>
      ) : (
        <>
          <p className="graph-helper__ends">
            {title(from)} <span className={Classes.TEXT_MUTED}>to</span> {title(to)}
          </p>
          {paths.error ? (
            <Callout intent="danger" compact>
              {paths.error.message}
            </Callout>
          ) : !data ? (
            <Spinner size={20} />
          ) : !data.found ? (
            <p className={`${Classes.TEXT_MUTED} graph-helper__hint`}>Nothing connects these two within eight hops.</p>
          ) : (
            <div className="graph-paths">
              {data.paths.map((p, i) => (
                <Button
                  key={i}
                  className="graph-path"
                  variant={lit === i ? 'outlined' : 'minimal'}
                  intent={lit === i ? 'primary' : 'none'}
                  alignText="start"
                  fill
                  aria-pressed={lit === i}
                  onClick={() => onLight(lit === i ? null : i)}
                  text={
                    <span className="graph-path__text">
                      <span className={Classes.TEXT_MUTED}>{p.hops === 1 ? '1 hop' : `${p.hops} hops`}</span>
                      <span>{p.objects.map((o) => o.title).join(' › ')}</span>
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Find path to…: the objects on the canvas first, then anything found by name. */
export function FindPathDialog({ from, title, onCanvas, onPick, onClose }: { from: string | null; title: (key: string) => string; onCanvas: Found[]; onPick: (to: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  return (
    <Dialog isOpen={!!from} onClose={onClose} title={from ? `Find path from ${title(from)} to…` : ''} className="graph-path-dialog" onClosed={() => setQuery('')}>
      <DialogBody>
        <InputGroup autoFocus leftIcon={<Search />} placeholder="Search by name" aria-label="Search by name" value={query} onValueChange={setQuery} />
        <div className="graph-path-dialog__results">
          {from && <SearchResults query={query} first={onCanvas.filter((f) => f.key !== from)} firstHeading="On the canvas" onPick={(f) => (f.key === from ? undefined : onPick(f.key))} />}
        </div>
      </DialogBody>
    </Dialog>
  );
}

export function EmptyCanvas({ onPick }: { onPick: (f: Found) => void }) {
  const [query, setQuery] = useState('');
  return (
    <div className="graph-empty">
      <NonIdealState icon={<Search size={48} />} title="Start a graph" description="Search for a person, an account or anything else. It opens in the middle with everything linked to it around it." />
      <InputGroup autoFocus leftIcon={<Search />} placeholder="Search by name" aria-label="Search by name" value={query} onValueChange={setQuery} className="graph-empty__search" />
      {query.trim() && (
        <div className="graph-empty__results">
          <SearchResults query={query} onPick={onPick} />
        </div>
      )}
    </div>
  );
}
