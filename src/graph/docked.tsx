// The panels docked under the Graph canvas, opened from Gotham's bottom tabs (G-Cloud 14 service definition, page 13).
// Timeline: every dated event of the objects on the canvas, one coloured series per kind, bins that touch across the
// whole range; a click on a bar picks its objects on the canvas, a drag across bars zooms. Table: the objects on the
// canvas as rows.
import { Button, Checkbox, Classes, Menu, MenuItem, Popover, Spinner } from '@blueprintjs/core';
import { CaretDown, Cross, Tick } from '@blueprintjs/icons';
import { useMemo, useRef, useState } from 'react';
import type { Catalog, ObjectView } from '../data/index.ts';
import { formatCount } from '../explorer/parts';
import { showValue } from '../explorer/steps';
import { binSizeFor, BIN_WORDS, floorTo, formatAt, formatRange, step, type BinSize } from '../timeline/bins';
import { useObjectsTimeline, type TimelineEvent } from './bridge';
import type { CanvasNode } from './canvas';
import { typeIcon } from './icons';
import { kindColours } from './kinds';

interface KindBin {
  start: number;
  end: number;
  counts: Map<string, number>;
  total: number;
  objects: Set<string>;
}

function binByKind(events: TimelineEvent[], from: number, until: number, size: BinSize): KindBin[] {
  const bins: KindBin[] = [];
  for (let t = floorTo(from, size); t <= until && bins.length < 400; t = step(t, size)) bins.push({ start: t, end: step(t, size), counts: new Map(), total: 0, objects: new Set() });
  for (const e of events) {
    const at = Date.parse(e.at);
    const bin = bins.find((b) => at >= b.start && at < b.end);
    if (!bin) continue;
    bin.counts.set(e.kind, (bin.counts.get(e.kind) ?? 0) + 1);
    bin.total += 1;
    for (const o of e.objectIds) bin.objects.add(o);
  }
  return bins;
}

/** A round top for the y axis and the gridline step under it. */
function scale(max: number): { top: number; gap: number } {
  const gap = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 50) * 10;
  return { top: Math.max(gap, Math.ceil(max / gap) * gap), gap };
}

type SizeChoice = 'auto' | BinSize;

export function DockedTimeline({ nodes, onPick, onClose }: { nodes: CanvasNode[]; onPick: (keys: string[]) => void; onClose: () => void }) {
  const keys = useMemo(() => nodes.map((n) => n.key), [nodes]);
  const onCanvas = useMemo(() => new Set(keys), [keys]);
  const timeline = useObjectsTimeline(keys);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [zoom, setZoom] = useState<{ from: number; until: number } | null>(null);
  const [choice, setChoice] = useState<SizeChoice>('auto');
  const [picked, setPicked] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const events = useMemo(() => timeline.data ?? [], [timeline.data]);
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  const kinds = kindColours(counts);
  const colour = new Map(kinds.map((k) => [k.kind, k.colour]));
  const shown = events.filter((e) => !hidden.has(e.kind));
  const times = events.map((e) => Date.parse(e.at)).filter(Number.isFinite);
  const from = zoom?.from ?? Math.min(...times);
  const until = zoom?.until ?? Math.max(...times);
  const size: BinSize = choice === 'auto' ? binSizeFor(until - from) : choice;
  const bins = useMemo(() => (times.length ? binByKind(shown, from, until, size) : []), [shown, from, until, size, times.length]);
  const { top, gap } = scale(Math.max(1, ...bins.map((b) => b.total)));
  const ticks = Math.max(1, Math.round(bins.length / 8));

  const finish = () => {
    const d = dragRef.current;
    setDrag(null);
    if (!d) return;
    if (d.a === d.b) {
      const bin = bins[d.a];
      setPicked((p) => (p === d.a ? null : d.a));
      if (bin) onPick([...bin.objects].filter((k) => onCanvas.has(k)));
    } else {
      setPicked(null);
      setZoom({ from: bins[Math.min(d.a, d.b)].start, until: bins[Math.max(d.a, d.b)].end - 1 });
    }
  };
  const lo = drag ? Math.min(drag.a, drag.b) : -1;
  const hi = drag ? Math.max(drag.a, drag.b) : -1;
  const allOn = hidden.size === 0;

  return (
    <section className="graph-dock graph-dock--timeline" aria-label="Timeline">
      <div className="graph-dock__head">
        <span className="graph-dock__title">Timeline</span>
        <span className={Classes.TEXT_MUTED}>{times.length ? `Showing ${formatRange(from, until)}` : ''}</span>
        {zoom && <Button variant="minimal" text="Reset zoom" onClick={() => (setZoom(null), setPicked(null))} />}
        <span className="graph-dock__spacer" />
        <Popover
          minimal
          placement="bottom-end"
          content={
            <Menu className="graph-binmenu">
              {(['auto', 'hour', 'day', 'week'] as SizeChoice[]).map((c) => (
                <MenuItem key={c} text={c === 'auto' ? 'Auto' : BIN_WORDS[c as BinSize][0].toUpperCase() + BIN_WORDS[c as BinSize].slice(1)} icon={choice === c ? <Tick /> : undefined} onClick={() => (setChoice(c), setPicked(null))} />
              ))}
            </Menu>
          }
        >
          <Button variant="minimal" endIcon={<CaretDown />} text={`Bin size: ${BIN_WORDS[size]}`} />
        </Popover>
        <Button variant="minimal" icon={<Cross />} aria-label="Close the timeline" onClick={onClose} />
      </div>
      <div className="graph-dock__body">
        {timeline.error ? (
          <p className={Classes.TEXT_MUTED}>{timeline.error.message}</p>
        ) : !timeline.data ? (
          <Spinner size={24} />
        ) : !events.length ? (
          <p className={Classes.TEXT_MUTED}>Nothing on the canvas carries a date yet.</p>
        ) : (
          <>
            <div className="graph-chart" onMouseLeave={() => setDrag(null)}>
              <div className="graph-chart__plot">
                <div className="graph-chart__grid" aria-hidden="true">
                  {Array.from({ length: top / gap + 1 }, (_, i) => i * gap).map((v) => (
                    <span key={v} className="graph-chart__gridline" style={{ bottom: `${(v / top) * 100}%` }}>
                      <span className={`graph-chart__ylabel ${Classes.TEXT_MUTED}`}>{v}</span>
                    </span>
                  ))}
                </div>
                <div className="graph-chart__bars" onMouseUp={finish}>
                  {bins.map((b, i) => (
                    <div
                      key={b.start}
                      className={['graph-chart__bin', picked === i && 'graph-chart__bin--picked', i >= lo && i <= hi && 'graph-chart__bin--dragged'].filter(Boolean).join(' ')}
                      role="button"
                      tabIndex={b.total ? 0 : -1}
                      aria-label={`${formatAt(b.start, size)}, ${b.total} events`}
                      aria-pressed={picked === i}
                      onMouseDown={(e) => (e.preventDefault(), setDrag({ a: i, b: i }))}
                      onMouseEnter={() => setDrag((d) => (d ? { ...d, b: i } : d))}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return;
                        e.preventDefault();
                        setPicked(i);
                        onPick([...b.objects].filter((k) => onCanvas.has(k)));
                      }}
                    >
                      {kinds.map(({ kind }) =>
                        b.counts.get(kind) ? <span key={kind} className="graph-chart__seg" style={{ height: `${((b.counts.get(kind) ?? 0) / top) * 100}%`, background: colour.get(kind) }} /> : null,
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="graph-chart__axis">
                {bins.map((b, i) =>
                  i % ticks === 0 ? (
                    <span key={b.start} className={Classes.TEXT_MUTED} style={{ left: `${(i / bins.length) * 100}%` }}>
                      {formatAt(b.start, size)}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
            <div className="graph-legend" aria-label="Kinds">
              <Checkbox
                className="graph-legend__parent"
                checked={allOn}
                indeterminate={!allOn && hidden.size < kinds.length}
                onChange={() => setHidden(allOn ? new Set(kinds.map((k) => k.kind)) : new Set())}
                labelElement={
                  <span className="graph-legend__row">
                    <strong>Kinds</strong>
                    <span className={Classes.TEXT_MUTED}>{formatCount(events.length)}</span>
                  </span>
                }
              />
              <div className="graph-legend__list">
                {kinds.map(({ kind, count, colour: c }) => (
                  <Checkbox
                    key={kind}
                    checked={!hidden.has(kind)}
                    onChange={() =>
                      setHidden((h) => {
                        const next = new Set(h);
                        if (next.has(kind)) next.delete(kind);
                        else next.add(kind);
                        return next;
                      })
                    }
                    labelElement={
                      <span className="graph-legend__row">
                        <span className="graph-legend__kind">{kind}</span>
                        <span className={Classes.TEXT_MUTED}>{formatCount(count)}</span>
                        <span className="graph-legend__swatch" style={{ background: c }} aria-hidden="true" />
                      </span>
                    }
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** A property worth a column: shown to people, not a key, not a raw id pointing at another object. */
function tableProperty(def: Catalog['types'][string] | undefined, apiName: string): boolean {
  if (!def) return false;
  if (apiName === def.primaryKey || apiName === def.titleProperty || apiName === 'scenario') return false;
  if (/Ids?$/.test(apiName)) return false;
  return !def.properties.find((p) => p.apiName === apiName)?.hidden;
}

/**
 * Gotham's Table: the objects on the canvas as rows. Name and type, then the properties most of them share, one
 * column each, then how many links each has on the canvas. The header stays put while the rows scroll. A click picks
 * the object.
 */
export function CanvasTable({ catalog, nodes, views, links, title, picked, onPick, onClose }: { catalog: Catalog; nodes: CanvasNode[]; views: Map<string, ObjectView>; links: Map<string, number>; title: (key: string) => string; picked: Set<string>; onPick: (key: string) => void; onClose: () => void }) {
  const columns = new Map<string, number>();
  for (const n of nodes) {
    const def = catalog.types[n.type];
    for (const p of views.get(n.key)?.properties ?? []) if (tableProperty(def, p.apiName) && showValue(p.value) !== '') columns.set(p.displayName, (columns.get(p.displayName) ?? 0) + 1);
  }
  const shown = [...columns].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([name]) => name);
  return (
    <section className="graph-dock graph-dock--table" aria-label="Table">
      <div className="graph-dock__head">
        <span className="graph-dock__title">Table</span>
        <span className={Classes.TEXT_MUTED}>{formatCount(nodes.length)} objects on the canvas</span>
        <span className="graph-dock__spacer" />
        <Button variant="minimal" icon={<Cross />} aria-label="Close the table" onClick={onClose} />
      </div>
      <div className="graph-dock__scroll">
        <table className="graph-table">
          <thead>
            <tr>
              {['Name', 'Type', ...shown, 'Links'].map((h) => (
                <th key={h}>
                  <span className="caps-heading">{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => {
              const def = catalog.types[n.type];
              const Icon = typeIcon(n.type);
              const values = new Map((views.get(n.key)?.properties ?? []).filter((p) => tableProperty(def, p.apiName)).map((p) => [p.displayName, showValue(p.value)]));
              return (
                <tr key={n.key} className={picked.has(n.key) ? 'graph-table__row graph-table__row--on' : 'graph-table__row'} onClick={() => onPick(n.key)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onPick(n.key)}>
                  <td>
                    <span className="graph-table__name">
                      <Icon /> {title(n.key)}
                    </span>
                  </td>
                  <td className={Classes.TEXT_MUTED}>{def?.displayName ?? n.type}</td>
                  {shown.map((c) => (
                    <td key={c}>{values.get(c) ?? ''}</td>
                  ))}
                  <td className="graph-table__num">{formatCount(links.get(n.key) ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
