// Graph (S4), the owner's approved layout of 10.10.2026 (the Content file, "BARGHEST Graph 1440 x 900"), after Gotham's
// Graph (G-Cloud 14 service definition, pages 11 to 13). Full bleed: a toolbar across the canvas, the search floating
// on it, Gotham's icon tiles and unlabelled links, zoom and a minimap at the bottom right, the bottom tabs (Table, Zoom
// to the selection, Timeline) with the Timeline docked under the canvas, and the helper strip and panel on the right
// (Histogram, Selection, Paths). A graph is a file (files.tsx): ?saved=<id> opens one and every change saves itself;
// with nothing open the view lists this investigation's graphs (home.tsx). A file holds the focus (opened with its
// neighbours on a ring), the path target (up to five shortest paths from the focus) and every object with where it sits.
import { Button, MenuItem, Tooltip } from '@blueprintjs/core';
import { Cross, HorizontalBarChart, Locate, PathSearch, Properties, Th, Time, ZoomIn, ZoomOut } from '@blueprintjs/icons';
import { applyNodeChanges, Background, BackgroundVariant, MiniMap, Panel, ReactFlow, ReactFlowProvider, useReactFlow, type NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { fetchRows, getObjectView, startExploration, useCatalog, useDataClient, withStep, type Catalog, type ObjectView } from '../data/index.ts';
import { EvidenceDrawer } from '../evidence/EvidenceDrawer';
import { Connecting, EngineDown } from '../explorer/parts';
import { navigate, useSearchParam, viewHref } from '../shell/route';
import { useDocumentTitle } from '../shell/title';
import { useWhatConnects, type ConnectionPath } from './bridge';
import { decodeNodes, deriveEdges, foldsOf, graphLinks, gridLayout, ICON_BOX, isGraphType, middleOf, NODE_W, nodesToRows, pairOf, placeAround, relationshipsOf, ringLayout, rowsToNodes, type CanvasNode, type EdgeModel } from './canvas';
import { CanvasTable, DockedTimeline } from './docked';
import { EDGE_TYPES, GraphActionsContext, NODE_TYPES, searchAroundItems, type GraphActions, type GraphEdgeType, type ObjectNodeType } from './elements';
import { FileGone, FileLoading, OpenFromLink, SaveStatus, useAutosave, useSavedFile, type FileLink, type SaveState } from './files';
import { EmptyCanvas, FindPathDialog, HistogramHelper, PathsHelper, SelectionHelper, type Picked } from './helpers';
import { SavedHome } from './home';
import { objectKey, parseKey } from './icons';
import { SearchBox, type Found } from './search';
import { GraphToolbar, type LabelMode } from './toolbar';
import './graph.css';

type Helper = 'histogram' | 'selection' | 'paths';
type Dock = 'timeline' | 'table' | null;

const HELPERS: Array<{ id: Helper; label: string; Icon: typeof Properties }> = [
  { id: 'histogram', label: 'Histogram', Icon: HorizontalBarChart },
  { id: 'selection', label: 'Selection', Icon: Properties },
  { id: 'paths', label: 'Paths', Icon: PathSearch },
];

export function Graph({ investigation }: { investigation: string }) {
  const saved = useSearchParam('saved');
  const focus = useSearchParam('focus');
  const nodes = useSearchParam('nodes');
  const to = useSearchParam('to');
  const { data: catalog, error } = useCatalog();
  if (error) return <EngineDown />;
  if (!catalog) return <Connecting />;
  if (saved) return <SavedGraph key={saved} id={saved} catalog={catalog} investigation={investigation} />;
  if (parseKey(focus) || decodeNodes(nodes)?.length) return <OpenFromLink investigation={investigation} kind="graph" link={graphLink(focus, to, nodes)} />;
  return <SavedHome investigation={investigation} kind="graph" />;
}

/** What a graph file holds. */
export interface GraphDoc {
  focus: string | null;
  to: string | null;
  nodes: CanvasNode[];
}

function graphDocOf(body: Record<string, unknown> | undefined): GraphDoc {
  const key = (v: unknown) => (typeof v === 'string' && parseKey(v) ? v : null);
  return { focus: key(body?.focus), to: key(body?.to), nodes: rowsToNodes(body?.nodes) ?? [] };
}

/** A link from another view: an object (?focus=), a path (?focus= and ?to=) or a set of objects (?nodes=). */
function graphLink(focus: string | null, to: string | null, nodesParam: string | null): FileLink {
  const nodes = decodeNodes(nodesParam) ?? [];
  const f = parseKey(focus) ? focus! : nodes[0].key;
  const target = parseKey(to) ? to : null;
  const origin = target ? `${f}>${target}` : nodes.length ? nodes.map((n) => n.key).sort().join(',') : f;
  return {
    origin,
    body: { focus: f, to: target, nodes: nodesToRows(nodes) },
    name: async (title) => (target ? `${await title(f)} to ${await title(target)}` : nodes.length > 1 ? `${await title(nodes[0].key)} and ${nodes.length - 1} more` : await title(f)),
  };
}

function SavedGraph({ id, catalog, investigation }: { id: string; catalog: Catalog; investigation: string }) {
  const item = useSavedFile(id, 'graph', investigation);
  const autosave = useAutosave(id);
  useDocumentTitle(item.data?.name ?? null);
  const onChange = useCallback((d: GraphDoc) => autosave.save({ ...item.data?.body, focus: d.focus, to: d.to, nodes: nodesToRows(d.nodes) }), [autosave.save, item.data?.body]);
  if (item.error) return <FileGone investigation={investigation} kind="graph" message={item.error.message} />;
  if (!item.data) return <FileLoading />;
  return (
    <ReactFlowProvider>
      <GraphScreen catalog={catalog} investigation={investigation} initial={graphDocOf(item.data.body)} onChange={onChange} saveState={autosave.state} />
    </ReactFlowProvider>
  );
}

/** The canvas a file opens: its objects, or the focus alone (it is expanded once its view arrives). */
function opening(doc: GraphDoc): CanvasNode[] {
  if (doc.nodes.length) return doc.nodes;
  const f = parseKey(doc.focus);
  return f ? [{ key: objectKey(f.type, f.pk), ...f, x: 0, y: 0 }] : [];
}

function GraphScreen({ catalog, investigation, initial, onChange, saveState }: { catalog: Catalog; investigation: string; initial: GraphDoc; onChange: (d: GraphDoc) => void; saveState: SaveState }) {
  const { dc } = useDataClient();
  const rf = useReactFlow<ObjectNodeType, GraphEdgeType>();

  const [focus, setFocus] = useState(initial.focus);
  const [to, setTo] = useState(initial.to);
  const [nodes, setNodes] = useState<CanvasNode[]>(() => opening(initial));
  const [views, setViews] = useState(() => new Map<string, ObjectView>());
  const [titles, setTitles] = useState(() => new Map<string, string>());
  const [busy, setBusy] = useState(() => new Set<string>());
  const [picked, setPicked] = useState<Picked | null>(null);
  const [helper, setHelper] = useState<Helper | null>('histogram');
  const [dock, setDock] = useState<Dock>('timeline');
  const [lit, setLit] = useState<number | null>(null);
  const [pathFrom, setPathFrom] = useState<string | null>(null);
  const [labels, setLabels] = useState<LabelMode>('hover');
  const [hovered, setHovered] = useState<string | null>(null);
  const [boxSelect, setBoxSelect] = useState(false);
  const [evidence, setEvidence] = useState<EdgeModel | null>(null);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const viewsRef = useRef(views);
  viewsRef.current = views;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const toRef = useRef(to);
  toRef.current = to;
  const loading = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const autoExpand = useRef<string | null>(initial.nodes.length ? null : initial.focus);

  // Every change goes to the file: the focus, the path target and the canvas.
  const save = useCallback(
    (patch: Partial<GraphDoc>) => {
      const next: GraphDoc = { focus: focusRef.current, to: toRef.current, nodes: nodesRef.current, ...patch };
      focusRef.current = next.focus;
      toRef.current = next.to;
      nodesRef.current = next.nodes;
      setFocus(next.focus);
      setTo(next.to);
      setNodes(next.nodes);
      onChange(next);
    },
    [onChange],
  );
  const commit = useCallback((next: CanvasNode[], extra: Partial<GraphDoc> = {}) => save({ nodes: next, ...extra }), [save]);

  const fitSoon = useCallback(() => {
    setTimeout(() => void rf.fitView({ padding: 0.2, maxZoom: 1 }), 80);
  }, [rf]);

  // Each object's view, four at a time: its title, properties, links and relationships. Edges come from these.
  useEffect(() => {
    if (!dc) return;
    const want = nodes.filter((n) => !views.has(n.key) && !loading.current.has(n.key) && !failed.current.has(n.key));
    for (const n of want.slice(0, Math.max(0, 4 - loading.current.size))) {
      loading.current.add(n.key);
      getObjectView(dc, n.type, n.pk).then(
        (v) => {
          loading.current.delete(n.key);
          setViews((m) => new Map(m).set(n.key, v));
        },
        () => {
          loading.current.delete(n.key);
          failed.current.add(n.key);
          setViews((m) => new Map(m));
        },
      );
    }
  }, [dc, nodes, views]);

  const expand = useCallback(
    async (key: string, only?: { link?: string; kind?: string }) => {
      const ref = parseKey(key);
      if (!dc || !ref) return;
      setBusy((b) => new Set(b).add(key));
      try {
        const view = viewsRef.current.get(key) ?? (await getObjectView(dc, ref.type, ref.pk));
        const found = new Map<string, string>();
        if (!only?.kind) {
          for (const g of graphLinks(view)) {
            if ((only?.link && only.link !== g.link) || !g.count) continue;
            let targets = g.first;
            // The view carries the first five of each link; a bigger link is read in full.
            if (g.count > g.first.length) {
              const self = withStep(startExploration(ref.type, 200), { filter: { property: catalog.types[ref.type].primaryKey, op: 'eq', value: ref.pk } });
              targets = (await fetchRows(dc, withStep(self, { pivot: g.link }))).rows.map((r) => ({ pk: r.pk, title: r.title }));
            }
            for (const t of targets) found.set(objectKey(g.targetType, t.pk), t.title);
          }
        }
        if (!only?.link) {
          for (const r of relationshipsOf(view)) if (!only?.kind || r.kind === only.kind) found.set(objectKey(r.otherType, r.otherPk), r.otherTitle);
        }
        setTitles((m) => new Map([...m, ...found]));
        const current = nodesRef.current;
        const have = new Set(current.map((n) => n.key));
        const fresh = [...found.keys()].filter((k) => k !== key && !have.has(k) && isGraphType(parseKey(k)?.type ?? 'Document'));
        if (!fresh.length) return;
        const parent = current.find((n) => n.key === key) ?? { x: 0, y: 0 };
        const away = key === focusRef.current || current.length < 2 ? null : middleOf(current, focusRef.current);
        const spots = placeAround(parent, fresh.length, current, away);
        commit([...current, ...fresh.map((k, i) => ({ key: k, ...parseKey(k)!, ...spots[i] }))]);
        fitSoon();
      } finally {
        setBusy((b) => {
          const next = new Set(b);
          next.delete(key);
          return next;
        });
      }
    },
    [dc, catalog, commit, fitSoon],
  );

  // A mention merged into another object folds into it, wherever it came from (a search, a link, an old file): one node
  // per real thing. Its place on the canvas goes to the canonical object unless that is already there.
  useEffect(() => {
    const folds = foldsOf(views);
    if (!nodesRef.current.some((n) => folds.has(n.key))) return;
    const fold = (k: string | null) => (k ? (folds.get(k) ?? k) : k);
    const kept = new Set<string>();
    const next: CanvasNode[] = [];
    for (const n of nodesRef.current) {
      const k = fold(n.key)!;
      if (kept.has(k)) continue;
      kept.add(k);
      next.push(k === n.key ? n : { ...n, key: k, pk: parseKey(k)!.pk });
    }
    autoExpand.current = fold(autoExpand.current);
    setTitles((m) => {
      const t = new Map(m);
      for (const [from, to] of folds) t.set(to, views.get(from)!.canonical!.title);
      return t;
    });
    setPicked(null);
    save({ nodes: next, focus: fold(focusRef.current), to: fold(toRef.current) });
  }, [views, save]);

  // A graph opened on a focus alone expands it once, as soon as its view is in.
  useEffect(() => {
    const k = autoExpand.current;
    if (k && views.has(k)) {
      autoExpand.current = null;
      void expand(k);
    }
  }, [views, expand]);

  // ---- Paths ----
  const paths = useWhatConnects(to && focus ? focus : null, to);
  // The paths a file was saved with are already on its canvas; only a new path target places objects.
  const placed = useRef(initial.nodes.length && initial.focus && initial.to ? `${initial.focus}>${initial.to}` : null);
  useEffect(() => {
    const data = paths.data;
    if (!data?.found) return;
    setLit(null);
    setHelper('paths');
    if (placed.current === `${data.from}>${data.to}`) return;
    placed.current = `${data.from}>${data.to}`;
    const current = nodesRef.current;
    const have = new Map(current.map((n) => [n.key, n]));
    setTitles((m) => new Map([...m, ...data.objects.map((o) => [objectKey(o.type, o.pk), o.title] as const)]));
    const folds = foldsOf(viewsRef.current, data.paths.flatMap((p) => p.steps));
    const added: CanvasNode[] = [];
    const at = (raw: string, spot: { x: number; y: number }) => {
      const key = folds.get(raw) ?? raw;
      const ref = parseKey(key);
      if (!ref || have.has(key) || added.some((a) => a.key === key)) return;
      added.push({ key, ...ref, ...spot });
    };
    const fromSpot = have.get(data.from) ?? middleOf(current, null) ?? { x: 0, y: 0 };
    at(data.from, fromSpot);
    const toSpot = have.get(data.to) ?? { x: fromSpot.x + 240 * Math.max(1, data.hops ?? 1), y: fromSpot.y };
    at(data.to, toSpot);
    const len = Math.hypot(toSpot.x - fromSpot.x, toSpot.y - fromSpot.y) || 1;
    const nx = -(toSpot.y - fromSpot.y) / len;
    const ny = (toSpot.x - fromSpot.x) / len;
    data.paths.forEach((p, i) => {
      const side = (i - (data.paths.length - 1) / 2) * 130;
      p.objects.forEach((o, j) => {
        const f = p.objects.length > 1 ? j / (p.objects.length - 1) : 0;
        at(objectKey(o.type, o.pk), { x: fromSpot.x + (toSpot.x - fromSpot.x) * f + nx * side, y: fromSpot.y + (toSpot.y - fromSpot.y) * f + ny * side });
      });
    });
    if (added.length) {
      commit([...current, ...added]);
      fitSoon();
    }
  }, [paths.data, commit, fitSoon]);

  const pathList = useMemo(() => (to && paths.data?.found ? paths.data.paths : []), [to, paths.data]);
  const litPaths = lit == null ? pathList : pathList.slice(lit, lit + 1);
  // A path can step through a mention to the object it was merged into; on the canvas both are one node.
  const folds = useMemo(() => foldsOf(views, pathList.flatMap((p) => p.steps)), [views, pathList]);
  const keysOf = useCallback(
    (p: ConnectionPath) => p.objects.map((o) => folds.get(objectKey(o.type, o.pk)) ?? objectKey(o.type, o.pk)).filter((k, i, all) => i === 0 || k !== all[i - 1]),
    [folds],
  );
  const litNodes = useMemo(() => (litPaths.length ? new Set(litPaths.flatMap(keysOf)) : null), [litPaths, keysOf]);
  const litPairs = useMemo(
    () =>
      litPaths.length
        ? new Set(
            litPaths.flatMap((p) => {
              const keys = keysOf(p);
              return keys.slice(1).map((k, i) => pairOf(keys[i], k));
            }),
          )
        : null,
    [litPaths, keysOf],
  );

  // ---- What React Flow draws ----
  const title = useCallback((key: string) => views.get(key)?.title ?? titles.get(key) ?? parseKey(key)?.pk ?? key, [views, titles]);
  const [rfNodes, setRfNodes] = useState<ObjectNodeType[]>([]);
  useEffect(() => {
    setRfNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      return nodes.map((m): ObjectNodeType => {
        const known = views.get(m.key)?.title ?? titles.get(m.key);
        return {
          ...byId.get(m.key),
          id: m.key,
          type: 'object',
          position: { x: m.x - NODE_W / 2, y: m.y - ICON_BOX / 2 },
          data: { type: m.type, pk: m.pk, title: known ?? m.pk, pending: !known && !failed.current.has(m.key), busy: busy.has(m.key), dim: !!litNodes && !litNodes.has(m.key), photoUrl: views.get(m.key)?.photo?.url },
        };
      });
    });
  }, [nodes, views, titles, busy, litNodes]);
  const onNodesChange = useCallback((changes: NodeChange<ObjectNodeType>[]) => setRfNodes((nds) => applyNodeChanges(changes, nds)), []);
  const selectedKeys = useMemo(() => rfNodes.filter((n) => n.selected).map((n) => n.id), [rfNodes]);
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const stepLinks = useMemo(() => pathList.flatMap((p) => p.steps), [pathList]);
  const edgeModels = useMemo(() => deriveEdges(nodes, views, catalog, stepLinks), [nodes, views, catalog, stepLinks]);
  const linkCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of edgeModels) for (const k of [e.source, e.target]) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  }, [edgeModels]);
  const rfEdges = useMemo(
    (): GraphEdgeType[] =>
      edgeModels.map((e) => {
        const onPath = !!litPairs?.has(pairOf(e.source, e.target));
        const isPicked = picked?.kind === 'edge' && picked.id === e.id;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'graph',
          data: { model: e, dim: !!litPairs && !onPath, lit: onPath, picked: isPicked, showLabel: labels === 'always' || (labels === 'hover' && (hovered === e.id || isPicked || onPath)) },
        };
      }),
    [edgeModels, litPairs, picked, labels, hovered],
  );

  // ---- Picking ----
  const pickKeys = useCallback((keys: string[]) => {
    const want = new Set(keys);
    setRfNodes((nds) => nds.map((n) => (n.selected === want.has(n.id) ? n : { ...n, selected: want.has(n.id) })));
    setPicked(keys.length === 1 ? { kind: 'node', key: keys[0] } : null);
  }, []);
  // A picked object keeps the open helper (the Histogram counts it against the rest, as Gotham's does); a picked link
  // opens Selection, the only helper that can show it.
  const pick = (p: Picked) => {
    setPicked(p);
    setHelper((h) => (p.kind === 'edge' ? 'selection' : (h ?? 'selection')));
  };

  // ---- Actions ----
  const go = useCallback((view: string, params: Record<string, string>) => navigate(`${viewHref(investigation, view)}?${new URLSearchParams(params)}`), [investigation]);
  const remove = useCallback(
    (key: string) => {
      const extra: Partial<GraphDoc> = key === focusRef.current ? { focus: null, to: null } : key === toRef.current ? { to: null } : {};
      commit(
        nodesRef.current.filter((n) => n.key !== key),
        extra,
      );
      setPicked((p) => (p?.kind === 'node' && p.key === key ? null : p));
    },
    [commit],
  );
  const actions = useMemo<GraphActions>(
    () => ({
      view: (key) => viewsRef.current.get(key),
      expand: (key, only) => void expand(key, only),
      remove,
      findPath: setPathFrom,
      openProfile: (key) => go('browser', { object: key }),
    }),
    [expand, remove, go],
  );

  /** A new graph on one object: it goes in the middle and expands once its view is in. */
  const startAt = (f: Found) => {
    setTitles((m) => new Map(m).set(f.key, f.title));
    autoExpand.current = f.key;
    setPicked(null);
    setLit(null);
    save({ focus: f.key, to: null, nodes: [{ key: f.key, type: f.type, pk: f.pk, x: 0, y: 0 }] });
  };

  const addObject = (f: Found) => {
    const current = nodesRef.current;
    if (!current.length) {
      startAt(f);
      return;
    }
    setTitles((m) => new Map(m).set(f.key, f.title));
    const existing = current.find((n) => n.key === f.key);
    const spot = existing ?? { x: Math.max(...current.map((n) => n.x)) + 240, y: middleOf(current, focus)?.y ?? 0 };
    if (!existing) commit([...current, { key: f.key, type: f.type, pk: f.pk, ...spot }]);
    pickKeys([f.key]);
    void rf.setCenter(spot.x, spot.y, { zoom: rf.getZoom() });
  };

  const relayout = (next: CanvasNode[]) => {
    commit(next);
    fitSoon();
  };
  const neighbours = () => {
    const near = new Set(selectedKeys);
    for (const e of edgeModels) {
      if (selectedSet.has(e.source)) near.add(e.target);
      if (selectedSet.has(e.target)) near.add(e.source);
    }
    pickKeys([...near]);
  };
  const searchAroundSelection: ReactElement = !selectedKeys.length ? (
    <MenuItem text="Pick one or more objects first" disabled />
  ) : selectedKeys.length === 1 ? (
    searchAroundItems(views.get(selectedKeys[0]), (only) => void expand(selectedKeys[0], only))
  ) : (
    <MenuItem text={`Everything around these ${selectedKeys.length}`} onClick={() => selectedKeys.forEach((k) => void expand(k))} />
  );

  const onCanvas: Found[] = nodes.map((n) => ({ key: n.key, type: n.type, pk: n.pk, title: title(n.key) }));
  const pickedEdge = picked?.kind === 'edge' ? edgeModels.find((e) => e.id === picked.id) : undefined;
  const pickedNode = picked?.kind === 'node' ? picked.key : null;

  return (
    <div className="graph" data-helper={helper ? 'open' : 'closed'}>
      <div className="graph__main">
        <GraphToolbar
          onRing={() => relayout(ringLayout(nodesRef.current, focus))}
          onGrid={() => relayout(gridLayout(nodesRef.current))}
          onFit={() => void rf.fitView({ padding: 0.2, maxZoom: 1 })}
          onSelectAll={() => pickKeys(nodes.map((n) => n.key))}
          onSelectNone={() => pickKeys([])}
          onSelectNeighbours={neighbours}
          boxSelect={boxSelect}
          onBoxSelect={() => setBoxSelect((b) => !b)}
          searchAround={searchAroundSelection}
          labels={labels}
          onLabels={setLabels}
          status={<SaveStatus state={saveState} />}
        />
        <div className="graph__canvas">
          {nodes.length ? (
            <GraphActionsContext.Provider value={actions}>
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                nodeTypes={NODE_TYPES}
                edgeTypes={EDGE_TYPES}
                onNodesChange={onNodesChange}
                onNodeDragStop={(_e, _n, dragged) => {
                  const moved = new Map(dragged.map((n) => [n.id, n.position]));
                  commit(nodesRef.current.map((m) => (moved.has(m.key) ? { ...m, x: moved.get(m.key)!.x + NODE_W / 2, y: moved.get(m.key)!.y + ICON_BOX / 2 } : m)));
                }}
                onNodeClick={(_e, n) => pick({ kind: 'node', key: n.id })}
                onNodeDoubleClick={(_e, n) => void expand(n.id)}
                onEdgeClick={(_e, e) => pick({ kind: 'edge', id: e.id })}
                onEdgeMouseEnter={(_e, e) => setHovered(e.id)}
                onEdgeMouseLeave={() => setHovered(null)}
                onPaneClick={() => setPicked(null)}
                nodesConnectable={false}
                zoomOnDoubleClick={false}
                deleteKeyCode={null}
                selectionOnDrag={boxSelect}
                panOnDrag={boxSelect ? [1, 2] : true}
                multiSelectionKeyCode={['Meta', 'Shift', 'Control']}
                minZoom={0.2}
                maxZoom={2}
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                proOptions={{ hideAttribution: true }}
                colorMode="dark"
              >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} />
                <Panel position="top-left" className="graph__find">
                  <SearchBox className="graph__search" placeholder="Find objects and links…" onPick={addObject} />
                </Panel>
                <Panel position="bottom-right" className="graph__zoom">
                  <ZoomButton label="Zoom in" icon={<ZoomIn />} onClick={() => void rf.zoomIn()} />
                  <ZoomButton label="Zoom out" icon={<ZoomOut />} onClick={() => void rf.zoomOut()} />
                </Panel>
                <MiniMap className="graph__minimap" position="bottom-right" pannable zoomable nodeClassName={(n) => (n.selected ? 'graph-minimap__node graph-minimap__node--picked' : 'graph-minimap__node')} nodeBorderRadius={2} />
              </ReactFlow>
            </GraphActionsContext.Provider>
          ) : (
            <EmptyCanvas onPick={startAt} />
          )}
          <div className="graph__tabs" role="tablist" aria-label="Under the canvas">
            <DockTab label="Table" icon={<Th />} on={dock === 'table'} onClick={() => setDock((d) => (d === 'table' ? null : 'table'))} />
            <DockTab label="Zoom to the selection" icon={<Locate />} on={false} onClick={() => void rf.fitView({ nodes: selectedKeys.map((id) => ({ id })), padding: 0.5, maxZoom: 1.2 })} />
            <DockTab label="Timeline" icon={<Time />} on={dock === 'timeline'} onClick={() => setDock((d) => (d === 'timeline' ? null : 'timeline'))} />
          </div>
        </div>
        {dock === 'timeline' && nodes.length > 0 && <DockedTimeline nodes={nodes} onPick={pickKeys} onClose={() => setDock(null)} />}
        {dock === 'table' && nodes.length > 0 && <CanvasTable catalog={catalog} nodes={nodes} views={views} links={linkCounts} title={title} picked={selectedSet} onPick={(k) => pickKeys([k])} onClose={() => setDock(null)} />}
      </div>

      <nav className="graph__strip" aria-label="Helpers">
        {HELPERS.map(({ id, label, Icon }) => (
          <Tooltip key={id} content={label} placement="left">
            <Button variant="minimal" icon={<Icon />} active={helper === id} aria-label={label} aria-pressed={helper === id} onClick={() => setHelper((h) => (h === id ? null : id))} />
          </Tooltip>
        ))}
      </nav>

      {helper && (
        <aside className="graph__helper" aria-label={HELPERS.find((h) => h.id === helper)?.label}>
          <div className="graph__helper-head">
            <span className="graph__helper-title">{HELPERS.find((h) => h.id === helper)?.label}</span>
            <Button variant="minimal" icon={<Cross />} aria-label="Close the helper" onClick={() => setHelper(null)} />
          </div>
          <div className="graph__helper-body">
            {helper === 'histogram' ? (
              <HistogramHelper catalog={catalog} nodes={nodes} views={views} edges={edgeModels} selected={selectedSet} onPick={pickKeys} />
            ) : helper === 'selection' ? (
              <SelectionHelper
                catalog={catalog}
                picked={picked}
                selectedCount={selectedKeys.length}
                selectedTitles={selectedKeys.map(title)}
                view={pickedNode ? views.get(pickedNode) : undefined}
                edge={pickedEdge}
                title={title}
                onOpenProfile={actions.openProfile}
                onAsk={(key) => go('assistant', { q: `What do the records say about ${title(key)}?` })}
                onEvidence={setEvidence}
              />
            ) : (
              <PathsHelper asked={!!to} paths={paths} lit={lit} onLight={setLit} onClear={() => save({ to: null })} title={title} from={focus} to={to} />
            )}
          </div>
        </aside>
      )}

      <FindPathDialog
        from={pathFrom}
        title={title}
        onCanvas={onCanvas}
        onClose={() => setPathFrom(null)}
        onPick={(target) => {
          const from = pathFrom;
          setPathFrom(null);
          if (from) {
            setLit(null);
            save({ focus: from, to: target });
          }
        }}
      />
      <EvidenceDrawer
        isOpen={!!evidence}
        passageIds={evidence?.relationship?.passages.map((p) => p.pk) ?? []}
        title={evidence ? `${title(evidence.source)} ${evidence.relationship ? evidence.relationship.kind.replace(/_/g, ' ') : evidence.label} ${title(evidence.target)}` : undefined}
        onClose={() => setEvidence(null)}
      />
    </div>
  );
}

function ZoomButton({ label, icon, onClick }: { label: string; icon: JSX.Element; onClick: () => void }) {
  return (
    <Tooltip content={label} placement="left">
      <Button icon={icon} aria-label={label} onClick={onClick} />
    </Tooltip>
  );
}

function DockTab({ label, icon, on, onClick }: { label: string; icon: JSX.Element; on: boolean; onClick: () => void }) {
  return (
    <Tooltip content={label} placement="top">
      <Button className={`graph__tab${on ? ' graph__tab--on' : ''}`} icon={icon} aria-label={label} role="tab" aria-selected={on} onClick={onClick} />
    </Tooltip>
  );
}

