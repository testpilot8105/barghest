// The Object Explorer, after Gotham's (the owner's screenshot, the G-Cloud 14 service definition's page 7 figure, and the
// owner's Figma frame of 09.10.2026). A Results card with Types, Properties and Links tabs. A click on a type, a value
// or a link narrows the set straight away (the owner, 09.10.2026: "we can just click around"); Shift-click gathers
// several values first, for Add to filter path. The filter path runs down the dock on the right, and View results
// opens the set in Browser. The set lives in the address bar (?exploration=), so every step is a history entry.
import { Button, H4, Tab, Tabs } from '@blueprintjs/core';
import { Database, FilterKeep } from '@blueprintjs/icons';
import { useState, type ReactElement } from 'react';
import {
  countRows,
  histogram,
  searchAround,
  startExploration,
  useAsync,
  useCatalog,
  useCount,
  useHistogram,
  useSearchAround,
  withStep,
  type Catalog,
  type CatalogProperty,
  type CatalogType,
  type Exploration,
} from '../data/index.ts';
import { EXPLORATION_PARAM } from '../shell/route';
import { useDocumentTitle } from '../shell/title';
import { BarList, type BarItem } from './BarList';
import { hasFilter, openExploration, useOpenExploration } from './exploration';
import { FilterPath } from './FilterPath';
import { BrokenLink, Connecting, CountText, EngineDown, Sentence } from './parts';
import { EMPTY_BUCKET, bucketLabel, filterFor, filterPhrase, multiSelect, setName, type Phrase } from './steps';

type TabId = 'types' | 'properties' | 'links';

export function Explorer({ investigation }: { investigation: string }) {
  const { data: catalog, error } = useCatalog();
  // A set opened from a link lands on its properties; a new exploration starts by picking a type.
  const [tab, setTab] = useState<TabId>(() => (new URLSearchParams(window.location.search).has(EXPLORATION_PARAM) ? 'properties' : 'types'));
  // Refresh re-mounts the screen, which re-runs every read.
  const [refreshed, setRefreshed] = useState(0);
  if (error) return <EngineDown />;
  if (!catalog) return <Connecting />;
  return <ExplorerScreen key={refreshed} catalog={catalog} investigation={investigation} tab={tab} onTab={setTab} onRefresh={() => setRefreshed((n) => n + 1)} />;
}

interface ScreenProps {
  catalog: Catalog;
  investigation: string;
  tab: TabId;
  onTab: (tab: TabId) => void;
  onRefresh: () => void;
}

/** The properties a histogram can be drawn for: visible, and not a list. */
function chartable(def: CatalogType): CatalogProperty[] {
  return def.properties.filter((p) => !p.hidden && p.histogram);
}

/** Open on the first property that says something about the set: not the key, not the title (both one per object). */
function firstTelling(def: CatalogType, props: CatalogProperty[]): CatalogProperty | undefined {
  return props.find((p) => p.apiName !== def.primaryKey && p.apiName !== def.titleProperty) ?? props[0];
}

function useTypeCounts(catalog: Catalog) {
  return useAsync(async (dc) => {
    const counts = await Promise.all(catalog.order.map((t) => countRows(dc, startExploration(t))));
    return Object.fromEntries(catalog.order.map((t, i) => [t, counts[i]])) as Record<string, number>;
  }, `types:${catalog.ontologyRid}`);
}

function ExplorerScreen({ catalog, investigation, tab, onTab, onRefresh }: ScreenProps) {
  const open = useOpenExploration(catalog);
  const typeCounts = useTypeCounts(catalog);
  const [picked, setPicked] = useState<{ scope: string; keys: string[] }>({ scope: '', keys: [] });
  const [chosenProperty, setChosenProperty] = useState<string | null>(null);
  useDocumentTitle(open.kind === 'broken' ? null : setName(catalog, open.kind === 'ok' ? open.exp : null));
  if (open.kind === 'broken') return <BrokenLink investigation={investigation} />;

  const exp = open.kind === 'ok' ? open.exp : null;
  const def = open.kind === 'ok' ? catalog.types[open.type] : null;
  const props = def ? chartable(def) : [];
  const property = props.find((p) => p.apiName === chosenProperty) ?? (def ? firstTelling(def, props) : undefined);
  // Every tab works at any time. Before a type is picked, Properties lists every type's properties and Links every
  // type's links; one click opens that type with that chart, or searches around from it (owner, 09.10.2026: greyed
  // tabs read as broken, and a tab that changed nothing read as dead).
  const activeTab: TabId = tab;
  const live = typeCounts.data ? catalog.order.filter((t) => typeCounts.data![t] > 0).sort((a, b) => typeCounts.data![b] - typeCounts.data![a]) : null;
  const total = typeCounts.data ? Object.values(typeCounts.data).reduce((a, b) => a + b, 0) : null;

  // A pick belongs to what was on screen when it was made: a new step, tab or property starts with nothing picked.
  const scope = `${open.kind === 'ok' ? open.encoded : ''}|${activeTab}|${activeTab === 'properties' ? (property?.apiName ?? '') : ''}`;
  const keys = picked.scope === scope ? picked.keys : [];
  const setKeys = (next: string[]) => setPicked({ scope, keys: next });
  const add = (next: Exploration) => {
    onTab('properties');
    openExploration(investigation, 'explorer', next);
  };

  let panel: ReactElement;
  if ((!exp || !def) && activeTab === 'properties') {
    panel = (
      <AllPropertiesPanel
        catalog={catalog}
        types={live}
        error={typeCounts.error}
        onOpen={(t, p) => {
          setChosenProperty(p);
          add(startExploration(t));
        }}
      />
    );
  } else if ((!exp || !def) && activeTab === 'links') {
    panel = <AllLinksPanel catalog={catalog} types={live} error={typeCounts.error} onOpen={(t, link) => add(withStep(startExploration(t), { pivot: link }))} />;
  } else if (!exp || !def) {
    panel = <TypesPanel catalog={catalog} counts={typeCounts.data} error={typeCounts.error} onStart={(t) => add(startExploration(t))} />;
  } else if (activeTab === 'types') {
    panel = <SetTypePanel exp={exp} def={def} />;
  } else if (activeTab === 'properties') {
    panel = (
      <PropertiesPanel
        catalog={catalog}
        exp={exp}
        def={def}
        props={props}
        property={property}
        onProperty={setChosenProperty}
        picked={keys}
        onPicked={setKeys}
        onAdd={add}
      />
    );
  } else {
    panel = <LinksPanel catalog={catalog} exp={exp} def={def} onAdd={add} />;
  }

  return (
    <div className="explorer">
      <section className="view-panel explorer__card" aria-label="Results">
        <header className="explorer__header">
          <div className="explorer__title">
            <span className="explorer__name">
              <Database />
              <H4>Results</H4>
            </span>
            <span className="bp6-text-muted">{exp ? <SetCount exp={exp} /> : <CountText state={{ data: total, loading: total == null, error: typeCounts.error }} noun="object" />}</span>
          </div>
          <Tabs id="explorer-tabs" selectedTabId={activeTab} onChange={(id) => onTab(id as TabId)}>
            <Tab id="types" title={<TabTitle label="Types" count={exp ? 1 : catalog.order.length} />} />
            <Tab id="properties" title={<TabTitle label="Properties" count={exp ? props.length : null} />} />
            <Tab id="links" title={<TabTitle label="Links" count={def ? def.links.length : null} />} />
          </Tabs>
        </header>
        {panel}
      </section>
      <FilterPath catalog={catalog} open={open} investigation={investigation} total={total} onRefresh={onRefresh} />
    </div>
  );
}

function SetCount({ exp }: { exp: Exploration }) {
  return <CountText state={useCount(exp)} noun="object" />;
}

function TabTitle({ label, count }: { label: string; count: number | null }) {
  return (
    <>
      {label}
      {count != null && <span className="explorer__tab-count bp6-text-muted">{count}</span>}
    </>
  );
}

/** The bar under the values: how to pick, or what the Shift-click pick will do in words, with Clear selection and Add to filter path. */
function SelectionBar({ phrase, hint, onClear, onAdd }: { phrase: Phrase | null; hint: string; onClear: () => void; onAdd: (() => void) | null }) {
  return (
    <div className="explorer__selection">
      <span className="explorer__sentence bp6-text-muted">{phrase ? <Sentence phrase={phrase} /> : hint}</span>
      {phrase && (
        <span className="explorer__actions">
          <Button variant="minimal" text="Clear selection" onClick={onClear} />
          <Button intent="primary" icon={<FilterKeep />} text="Add to filter path" disabled={!onAdd} onClick={onAdd ?? undefined} />
        </span>
      )}
    </div>
  );
}

/** The line under a list that says what a click does. */
function Hint({ text }: { text: string }) {
  return (
    <div className="explorer__selection">
      <span className="explorer__sentence bp6-text-muted">{text}</span>
    </div>
  );
}

/** Every type with its count; a click starts the exploration on that type. */
function TypesPanel({ catalog, counts, error, onStart }: { catalog: Catalog; counts: Record<string, number> | null; error: Error | null; onStart: (type: string) => void }) {
  const items: BarItem[] = catalog.order.map((t) => ({ key: t, label: catalog.types[t].pluralDisplayName, count: counts ? counts[t] : null }));
  if (counts) items.sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label));
  const max = counts ? Math.max(0, ...Object.values(counts)) : 0;
  return (
    <div className="explorer__body">
      <BarList heading="Object types" items={items} error={error} max={max} picked={[]} onPick={onStart} layout="long" empty="No object types." />
    </div>
  );
}

interface AllPanelProps {
  catalog: Catalog;
  /** the types that have objects, biggest first; null while they're counted */
  types: string[] | null;
  error: Error | null;
  onOpen: (type: string, key: string) => void;
}

/** Before a type is picked: every property of every type with objects, and how many of them carry a value. A click
 *  opens that type with that property's chart. */
function AllPropertiesPanel({ catalog, types, error, onOpen }: AllPanelProps) {
  const pairs = (types ?? []).flatMap((t) => chartable(catalog.types[t]).map((p) => ({ type: t, prop: p })));
  const counts = useAsync(async (dc) => {
    const hs = await Promise.all(pairs.map(({ type, prop }) => histogram(dc, startExploration(type), prop.apiName)));
    return hs.map((h) => h.total - (h.buckets.find((b) => b.bucket === EMPTY_BUCKET)?.count ?? 0));
  }, `all-properties:${(types ?? []).join(',')}`);
  const ready = types && counts.data && !counts.loading ? counts.data : null;
  const items: BarItem[] | null = types
    ? pairs.map(({ type, prop }, i) => ({ key: `${type}:${prop.apiName}`, label: prop.displayName, detail: catalog.types[type].pluralDisplayName, count: ready ? (ready[i] ?? 0) : null }))
    : null;
  const max = ready ? Math.max(0, ...ready) : 0;
  const open = (key: string) => {
    const [type, prop] = key.split(':');
    onOpen(type, prop);
  };
  return (
    <>
      <div className="explorer__body">
        <BarList heading="Object properties" items={items} error={error ?? counts.error} max={max} picked={[]} onPick={open} layout="links" empty="No properties." />
      </div>
      <Hint text="Click a property to open its type with that chart." />
    </>
  );
}

/** Before a type is picked: every link of every type with objects, and how many objects it reaches. A click searches
 *  around from that type. */
function AllLinksPanel({ catalog, types, error, onOpen }: AllPanelProps) {
  const around = useAsync(async (dc) => {
    const lists = await Promise.all((types ?? []).map((t) => searchAround(dc, startExploration(t))));
    return lists.flatMap((ls, i) => ls.map((l) => ({ ...l, from: (types ?? [])[i] })));
  }, `all-links:${(types ?? []).join(',')}`);
  const items: BarItem[] | null =
    types && around.data && !around.loading
      ? around.data.map((l) => ({ key: `${l.from}:${l.link}`, label: l.displayName, detail: `of ${catalog.types[l.from].pluralDisplayName}`, count: l.count }))
      : null;
  const max = around.data ? Math.max(0, ...around.data.map((l) => l.count)) : 0;
  const open = (key: string) => {
    const [type, link] = key.split(':');
    onOpen(type, link);
  };
  return (
    <>
      <div className="explorer__body">
        <BarList heading="Links" items={items} error={error ?? around.error} max={max} picked={[]} onPick={open} layout="links" empty="No links." />
      </div>
      <Hint text="Click a link to open the objects it reaches." />
    </>
  );
}

/** The Types tab once a set is open: a set holds one type, so this is a single fixed bar. */
function SetTypePanel({ exp, def }: { exp: Exploration; def: CatalogType }) {
  const count = useCount(exp);
  return (
    <div className="explorer__body">
      <BarList heading="Object types" items={[{ key: def.apiName, label: def.pluralDisplayName, count: count.data, fixed: true }]} error={count.error} max={count.data ?? 0} picked={[]} layout="long" empty="No object types." />
    </div>
  );
}

function usePropertyCounts(exp: Exploration, props: CatalogProperty[]) {
  const names = props.map((p) => p.apiName);
  return useAsync(async (dc) => {
    const hs = await Promise.all(names.map((n) => histogram(dc, exp, n)));
    return Object.fromEntries(hs.map((h) => [h.property, h.total - (h.buckets.find((b) => b.bucket === EMPTY_BUCKET)?.count ?? 0)])) as Record<string, number>;
  }, `${JSON.stringify(exp)}|${names.join(',')}`);
}

interface PropertiesPanelProps {
  catalog: Catalog;
  exp: Exploration;
  def: CatalogType;
  props: CatalogProperty[];
  property: CatalogProperty | undefined;
  onProperty: (apiName: string) => void;
  picked: string[];
  onPicked: (keys: string[]) => void;
  onAdd: (next: Exploration) => void;
}

function PropertiesPanel({ catalog, exp, def, props, property, onProperty, picked, onPicked, onAdd }: PropertiesPanelProps) {
  const setCount = useCount(exp);
  const counts = usePropertyCounts(exp, props);
  const hist = useHistogram(exp, property?.apiName ?? null);

  const listItems: BarItem[] = props.map((p) => ({ key: p.apiName, label: p.displayName, count: counts.data ? (counts.data[p.apiName] ?? 0) : null }));
  const kind = hist.data?.kind ?? property?.histogram ?? 'exact';
  const valueItems: BarItem[] | null = hist.data
    ? [
        ...hist.data.buckets.map((b) => ({ key: b.bucket, label: bucketLabel(kind, b.bucket), count: b.count })),
        ...(hist.data.other ? [{ key: '\u0000other', label: 'All other values', count: hist.data.other, fixed: true }] : []),
      ]
    : null;
  const valueMax = hist.data ? Math.max(0, ...hist.data.buckets.map((b) => b.count), hist.data.other) : 0;

  // A click keeps that one value straight away. Shift-click gathers several of an exact property's values for Add to
  // filter path; "No value" and number or date ranges can't be combined, so they always act alone.
  const pick = (key: string, more: boolean) => {
    if (more && multiSelect(kind) && key !== EMPTY_BUCKET) {
      onPicked(picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key]);
      return;
    }
    const one = property && filterFor(property, kind, [key]);
    if (one && !hasFilter(exp, one)) onAdd(withStep(exp, { filter: one }));
  };
  const filter = property ? filterFor(property, kind, picked) : null;

  return (
    <>
      <div className="explorer__body explorer__body--split">
        <BarList
          heading="Object properties"
          items={listItems}
          error={counts.error}
          max={setCount.data ?? 0}
          picked={property ? [property.apiName] : []}
          onPick={onProperty}
          layout="short"
          empty={`${def.displayName} has no properties to chart.`}
        />
        {property ? (
          <BarList heading={property.displayName} items={valueItems} error={hist.error} max={valueMax} picked={picked} onPick={pick} layout="long" empty="No values in this set." searchBar />
        ) : (
          <div />
        )}
      </div>
      <SelectionBar
        phrase={filter ? filterPhrase(catalog, def.apiName, filter) : null}
        hint={multiSelect(kind) ? 'Click a value to filter by it. Shift-click to pick several.' : 'Click a value to filter by it.'}
        onClear={() => onPicked([])}
        onAdd={filter ? () => (hasFilter(exp, filter) ? onPicked([]) : onAdd(withStep(exp, { filter }))) : null}
      />
    </>
  );
}

/** The set's links with how many objects each reaches; a click searches around to them. */
function LinksPanel({ catalog, exp, def, onAdd }: { catalog: Catalog; exp: Exploration; def: CatalogType; onAdd: (next: Exploration) => void }) {
  const around = useSearchAround(exp);
  const items: BarItem[] | null = around.data
    ? around.data.map((l) => ({ key: l.link, label: l.displayName, detail: catalog.types[l.targetType]?.pluralDisplayName ?? l.targetType, count: l.count }))
    : null;
  const max = around.data ? Math.max(0, ...around.data.map((l) => l.count)) : 0;
  return (
    <div className="explorer__body">
      <BarList heading="Links" items={items} error={around.error} max={max} picked={[]} onPick={(k) => onAdd(withStep(exp, { pivot: k }))} layout="links" empty={`${def.displayName} has no links.`} />
    </div>
  );
}
