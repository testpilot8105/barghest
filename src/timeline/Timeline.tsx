// Timeline (S5), the owner's pick of 10.10.2026 (the Content file, "BARGHEST Timeline 1440 x 900, Builder 3 redesign",
// the calmer version): everything dated within a few hops of one or more objects. Full bleed: the subject bar, then
// Gotham's chart (bars stacked by tag, the shown range, a bin size, the deletion gap as a band and a marker, an overview
// of the whole span to zoom from, tags and kinds to tick), then the events as a table beside the picked event's panel
// (its passage, its objects). A timeline is a file (../graph/files.tsx): ?saved=<id> opens one and every change saves
// itself; it holds the subjects, the hops and the zoom. With nothing open the view lists this investigation's timelines.
import { AnchorButton, Blockquote, Button, Callout, Checkbox, Classes, H6, InputGroup, Menu, MenuItem, NonIdealState, Popover, SegmentedControl, Spinner, Tag } from '@blueprintjs/core';
import { CaretDown, Cross, Document, Graph as GraphIcon, Search, Tick, WarningSign } from '@blueprintjs/icons';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { getObjectView, useAsync, useCatalog, type Catalog } from '../data/index.ts';
import { filesHref, follow } from '../browser/links';
import { usePassageFiles } from '../evidence/passages';
import { Connecting, EngineDown, formatCount } from '../explorer/parts';
import { useSubjectsTimeline, type TimelineEvent, type TimelineTag } from '../graph/bridge';
import { encodeNodes } from '../graph/canvas';
import { FileGone, FileLoading, OpenFromLink, SaveStatus, useAutosave, useSavedFile, type FileLink, type SaveState } from '../graph/files';
import { SavedHome } from '../graph/home';
import { parseKey, typeIcon } from '../graph/icons';
import { SearchBox, SearchResults, type Found } from '../graph/search';
import { EventPhoto } from '../photos';
import { findView, paletteVar } from '../shell/nav';
import { navigate, useSearchParam, viewHref } from '../shell/route';
import { useDocumentTitle } from '../shell/title';
import { BIN_WORDS, binSizeFor, formatAt, formatBin, formatClock, formatRange, isFlag, makeBins, TAGS, type Bin, type BinSize } from './bins';
import './timeline.css';

const TAG_WORDS: Record<TimelineTag, string> = { observed: 'Observed', system: 'System', analyst: 'Analyst' };
const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const longFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const utcFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });

/** A source with only a date lands at midnight UTC; the table says "date only" instead of a made-up time. */
const dateOnly = (at: string) => /T00:00:00(\.000)?Z$/.test(at);

export function Timeline({ investigation }: { investigation: string }) {
  const saved = useSearchParam('saved');
  const object = useSearchParam('object');
  const hops = useSearchParam('hops');
  const from = useSearchParam('from');
  const until = useSearchParam('until');
  const { data: catalog, error } = useCatalog();
  if (error) return <EngineDown />;
  if (!catalog) return <Connecting />;
  if (saved) return <SavedTimeline key={saved} id={saved} catalog={catalog} investigation={investigation} />;
  if (parseKey(object)) return <OpenFromLink investigation={investigation} kind="timeline" link={timelineLink(object!, hops, from, until)} />;
  return <SavedHome investigation={investigation} kind="timeline" />;
}

/** What a timeline file holds. */
export interface TimelineDoc {
  subjects: string[];
  hops: number;
  from: string | null;
  until: string | null;
}

const clampHops = (v: unknown) => Math.min(3, Math.max(1, Math.round(Number(v)) || 2));
const isoOrNull = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null);

function timelineDocOf(body: Record<string, unknown> | undefined): TimelineDoc {
  const subjects = Array.isArray(body?.subjects) ? (body.subjects as unknown[]).filter((k): k is string => typeof k === 'string' && !!parseKey(k)) : [];
  return { subjects: [...new Set(subjects)], hops: clampHops(body?.hops), from: isoOrNull(body?.from), until: isoOrNull(body?.until) };
}

/** A link from another view names one object (?object=), with the hops and a zoom if it wants them. */
function timelineLink(object: string, hops: string | null, from: string | null, until: string | null): FileLink {
  return { origin: object, body: { subjects: [object], hops: clampHops(hops), from: isoOrNull(from), until: isoOrNull(until) }, name: (title) => title(object) };
}

function SavedTimeline({ id, catalog, investigation }: { id: string; catalog: Catalog; investigation: string }) {
  const item = useSavedFile(id, 'timeline', investigation);
  const autosave = useAutosave(id);
  useDocumentTitle(item.data?.name ?? null);
  const onChange = useCallback((d: TimelineDoc) => autosave.save({ ...item.data?.body, ...d }), [autosave.save, item.data?.body]);
  if (item.error) return <FileGone investigation={investigation} kind="timeline" message={item.error.message} />;
  if (!item.data) return <FileLoading />;
  return <TimelineScreen catalog={catalog} investigation={investigation} initial={timelineDocOf(item.data.body)} onChange={onChange} saveState={autosave.state} />;
}

function NoSubject({ onPick }: { onPick: (f: Found) => void }) {
  const view = findView('timeline');
  const [query, setQuery] = useState('');
  return (
    <div className="timeline timeline--empty">
      <NonIdealState icon={view && <view.Icon size={48} color={paletteVar(view.color)} />} title="No object picked" description="Search for a person, an account or anything else to see everything dated around it." />
      <InputGroup autoFocus leftIcon={<Search />} placeholder="Search by name" aria-label="Search by name" value={query} onValueChange={setQuery} className="timeline__search" />
      {query.trim() && (
        <div className="timeline__results">
          <SearchResults query={query} onPick={onPick} />
        </div>
      )}
    </div>
  );
}

type SizeChoice = 'auto' | BinSize;

interface ScreenProps {
  catalog: Catalog;
  investigation: string;
  initial: TimelineDoc;
  onChange: (d: TimelineDoc) => void;
  saveState: SaveState;
}

function TimelineScreen({ initial, onChange, ...rest }: ScreenProps) {
  const [doc, setDoc] = useState(initial);
  const docRef = useRef(doc);
  const change = useCallback(
    (patch: Partial<TimelineDoc>) => {
      const next = { ...docRef.current, ...patch };
      docRef.current = next;
      setDoc(next);
      onChange(next);
    },
    [onChange],
  );
  if (!doc.subjects.length) return <NoSubject onPick={(f) => change({ subjects: [f.key], from: null, until: null })} />;
  return <TimelineBody {...rest} doc={doc} change={change} />;
}

function TimelineBody({ catalog, investigation, doc, change, saveState }: Omit<ScreenProps, 'initial' | 'onChange'> & { doc: TimelineDoc; change: (patch: Partial<TimelineDoc>) => void }) {
  const { subjects, hops } = doc;
  const fromParam = Date.parse(doc.from ?? '');
  const untilParam = Date.parse(doc.until ?? '');
  const titles = useObjectTitles(subjects);
  const timeline = useSubjectsTimeline(subjects, hops);
  const [hiddenTags, setHiddenTags] = useState<Set<TimelineTag>>(() => new Set());
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(() => new Set());
  const [allKinds, setAllKinds] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [choice, setChoice] = useState<SizeChoice>('auto');
  const [pickedBin, setPickedBin] = useState<number | null>(null);
  const [pickedEvent, setPickedEvent] = useState<string | null>(null);
  const names = subjects.map((k) => titles.data?.find((t) => t.id === k)?.title ?? parseKey(k)?.pk ?? k);

  const events = useMemo(() => timeline.data?.events ?? [], [timeline.data]);
  const times = events.map((e) => Date.parse(e.at)).filter(Number.isFinite);
  const zoomed = Number.isFinite(fromParam) && Number.isFinite(untilParam) && untilParam > fromParam;
  const from = zoomed ? fromParam : Math.min(...times);
  const until = zoomed ? untilParam : Math.max(...times);
  const size: BinSize = choice === 'auto' ? binSizeFor(until - from) : choice;
  const doubtful = (e: TimelineEvent) => (e.confidence != null && e.confidence < 0.9) || e.status === 'review';
  const visible = useMemo(() => events.filter((e) => !hiddenTags.has(e.tag) && !hiddenKinds.has(e.kind) && (!reviewOnly || doubtful(e))), [events, hiddenTags, hiddenKinds, reviewOnly]);
  const bins = useMemo(() => (times.length ? makeBins(visible, from, until, size) : []), [visible, from, until, size, times.length]);
  const bin = pickedBin != null ? bins[pickedBin] : undefined;
  const inZoom = visible.filter((e) => {
    const at = Date.parse(e.at);
    return at >= (bins[0]?.start ?? -Infinity) && at < (bins[bins.length - 1]?.end ?? Infinity);
  });
  const listed = bin ? inZoom.filter((e) => Date.parse(e.at) >= bin.start && Date.parse(e.at) < bin.end) : inZoom;
  const flagged = events.find(isFlag);
  const picked = events.find((e) => e.id === (pickedEvent ?? flagged?.id)) ?? null;
  const kindCounts = new Map<string, number>();
  for (const e of events) kindCounts.set(e.kind, (kindCounts.get(e.kind) ?? 0) + 1);
  const kinds = [...kindCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const zoomTo = (a: number, b: number) => {
    setPickedBin(null);
    change({ from: new Date(Math.min(a, b)).toISOString(), until: new Date(Math.max(a, b)).toISOString() });
  };
  const toggle = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  return (
    <div className="timeline">
      <div className="timeline__subject">
        {subjects.map((k, i) => {
          const r = parseKey(k)!;
          const SubjectIcon = typeIcon(r.type);
          return (
            <Tag key={k} className="timeline__chip" size="large" icon={<SubjectIcon />} onRemove={() => (setPickedBin(null), change({ subjects: subjects.filter((s) => s !== k), from: null, until: null }))}>
              <strong className={titles.data ? '' : Classes.SKELETON}>{names[i]}</strong> <span className={Classes.TEXT_MUTED}>{catalog.types[r.type]?.displayName ?? r.type}</span>
            </Tag>
          );
        })}
        <span className={Classes.TEXT_MUTED}>Hops</span>
        <SegmentedControl
          aria-label="Hops"
          value={String(hops)}
          onValueChange={(v) => {
            setPickedBin(null);
            change({ hops: Number(v) });
          }}
          options={['1', '2', '3'].map((v) => ({ label: v, value: v }))}
        />
        <span className={Classes.TEXT_MUTED}>{timeline.data ? `${formatCount(events.length)} events, ${timeline.data.objects != null ? `${formatCount(timeline.data.objects)} objects reached` : `from ${subjects.length} objects`}` : ''}</span>
        <span className="timeline__spacer" />
        <SaveStatus state={saveState} />
        <SearchBox className="timeline__other" placeholder="Add an object to this timeline" onPick={(f) => !subjects.includes(f.key) && (setPickedBin(null), change({ subjects: [...subjects, f.key] }))} />
      </div>

      {timeline.error ? (
        <div className="timeline__state">
          <Callout intent="danger" compact>
            {timeline.error.message}
          </Callout>
        </div>
      ) : !timeline.data ? (
        <div className="timeline__state">
          <Spinner size={32} />
        </div>
      ) : !events.length ? (
        <div className="timeline__state">
          <NonIdealState title="Nothing dated" description={`Nothing within ${hops === 1 ? '1 hop' : `${hops} hops`} of ${names.join(' or ')} carries a date.`} action={hops < 3 ? <Button text={`Try ${hops + 1} hops`} onClick={() => change({ hops: hops + 1 })} /> : undefined} />
        </div>
      ) : (
        <>
          <section className="timeline__chart" aria-label="Events over time">
            <div className="timeline__chart-head">
              <H6 className={`caps-heading ${Classes.TEXT_MUTED}`}>Timeline</H6>
              <span>Showing {formatRange(from, until)}</span>
              {zoomed && <Button variant="minimal" className="timeline__reset" text="Reset zoom" onClick={() => (setPickedBin(null), change({ from: null, until: null }))} />}
              <span className="timeline__spacer" />
              <Popover
                minimal
                placement="bottom-end"
                content={
                  <Menu>
                    {(['auto', 'hour', 'day', 'week'] as SizeChoice[]).map((c) => (
                      <MenuItem key={c} text={c === 'auto' ? 'Auto' : BIN_WORDS[c as BinSize][0].toUpperCase() + BIN_WORDS[c as BinSize].slice(1)} icon={choice === c ? <Tick /> : undefined} onClick={() => (setChoice(c), setPickedBin(null))} />
                    ))}
                  </Menu>
                }
              >
                <Button variant="minimal" endIcon={<CaretDown />} text={`Bin size: ${BIN_WORDS[size]}${choice === 'auto' ? ' (auto)' : ''}`} />
              </Popover>
            </div>
            <div className="timeline__chart-body">
              <div className="timeline__chart-main">
                <Histogram bins={bins} size={size} picked={pickedBin} onPick={(i) => setPickedBin((p) => (p === i ? null : i))} onZoom={(a, b) => zoomTo(a.start, b.end - 1)} />
                <Overview events={events} from={from} until={until} onZoom={zoomTo} />
              </div>
              <div className="timeline__legend">
                <H6 className={`caps-heading ${Classes.TEXT_MUTED}`}>Tags</H6>
                {TAGS.map((t) => (
                  <Checkbox
                    key={t}
                    checked={!hiddenTags.has(t)}
                    onChange={() => setHiddenTags((h) => toggle(h, t))}
                    labelElement={
                      <span className="timeline__legend-row">
                        <span className={`timeline-swatch timeline-swatch--${t}`} aria-hidden="true" />
                        <span>{TAG_WORDS[t]}</span>
                        <span className={Classes.TEXT_MUTED}>{formatCount(events.filter((e) => e.tag === t).length)}</span>
                      </span>
                    }
                  />
                ))}
                <H6 className={`caps-heading ${Classes.TEXT_MUTED}`}>Kinds</H6>
                <div className="timeline__kinds">
                  {(allKinds ? kinds : kinds.slice(0, 4)).map(([k, n]) => (
                    <Checkbox
                      key={k}
                      checked={!hiddenKinds.has(k)}
                      onChange={() => setHiddenKinds((h) => toggle(h, k))}
                      labelElement={
                        <span className="timeline__legend-row timeline__legend-row--kind">
                          <span>{k}</span>
                          <span className={Classes.TEXT_MUTED}>{formatCount(n)}</span>
                        </span>
                      }
                    />
                  ))}
                </div>
                {kinds.length > 4 && <Button variant="minimal" className="timeline__more" text={allKinds ? 'Show fewer' : `Show all ${kinds.length} kinds…`} onClick={() => setAllKinds((a) => !a)} />}
              </div>
            </div>
          </section>

          <div className="timeline__lower">
            <div className="timeline__events">
              <div className="timeline__filter">
                {bin ? (
                  <>
                    <span>
                      {formatBin(bin, size)} · {listed.length === 1 ? '1 event' : `${formatCount(listed.length)} events`}
                    </span>
                    <Button variant="minimal" text="Clear" onClick={() => setPickedBin(null)} />
                  </>
                ) : (
                  <span className={Classes.TEXT_MUTED}>
                    {`${formatCount(listed.length)} of ${formatCount(events.length)} events${zoomed ? ' in the zoom' : ''}, oldest first`}
                  </span>
                )}
                <span className="timeline__spacer" />
                <Checkbox
                  checked={reviewOnly}
                  onChange={() => setReviewOnly((r) => !r)}
                  labelElement={
                    <span className="timeline__legend-row timeline__legend-row--filter">
                      <span>Only below 0.90 or in review</span>
                      <span className={Classes.TEXT_MUTED}>{formatCount(events.filter(doubtful).length)}</span>
                    </span>
                  }
                />
              </div>
              <EventTable events={listed} picked={picked?.id ?? null} onPick={setPickedEvent} />
            </div>
            <EventPanel event={picked} investigation={investigation} onClose={() => setPickedEvent('')} />
          </div>
        </>
      )}
    </div>
  );
}

/** Bars stacked by tag, one per bin; a click filters the table, a drag across bars zooms. */
function Histogram({ bins, size, picked, onPick, onZoom }: { bins: Bin[]; size: BinSize; picked: number | null; onPick: (i: number) => void; onZoom: (a: Bin, b: Bin) => void }) {
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const max = Math.max(1, ...bins.map((b) => b.total));
  const gap = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : 10;
  const top = Math.ceil(max / gap) * gap;
  const ticks = Math.max(1, Math.round(bins.length / 12));
  const flagAt = bins.findIndex((b) => b.flagged);
  const lo = drag ? Math.min(drag.a, drag.b) : -1;
  const hi = drag ? Math.max(drag.a, drag.b) : -1;
  const finish = () => {
    const d = dragRef.current;
    setDrag(null);
    if (!d) return;
    if (d.a === d.b) onPick(d.a);
    else onZoom(bins[Math.min(d.a, d.b)], bins[Math.max(d.a, d.b)]);
  };
  return (
    <div className="timeline-histogram" onMouseLeave={() => setDrag(null)}>
      <div className="timeline-histogram__plot">
        {Array.from({ length: top / gap + 1 }, (_, i) => i * gap).map((v) => (
          <span key={v} className="timeline-histogram__gridline" style={{ bottom: `${(v / top) * 100}%` }}>
            <span className={Classes.TEXT_MUTED}>{v}</span>
          </span>
        ))}
        <div className="timeline-histogram__bars" onMouseUp={finish}>
          {bins.map((b, i) => (
            <div
              key={b.start}
              className={['timeline-bin', b.flagged && 'timeline-bin--flagged', picked === i && 'timeline-bin--picked', i >= lo && i <= hi && 'timeline-bin--dragged'].filter(Boolean).join(' ')}
              role="button"
              tabIndex={b.total ? 0 : -1}
              aria-label={`${formatBin(b, size)}, ${b.total} events`}
              aria-pressed={picked === i}
              onMouseDown={(e) => (e.preventDefault(), setDrag({ a: i, b: i }))}
              onMouseEnter={() => setDrag((d) => (d ? { ...d, b: i } : d))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPick(i);
                }
              }}
            >
              {TAGS.map((t) => (b.counts[t] ? <span key={t} className={`timeline-bin__seg timeline-swatch--${t}`} style={{ height: `${(b.counts[t] / top) * 100}%` }} /> : null))}
            </div>
          ))}
        </div>
        {flagAt >= 0 && (
          <span className="timeline-histogram__flag" style={{ left: `${((flagAt + 1) / bins.length) * 100}%` }}>
            <WarningSign /> Deletion gap flagged by the system, {formatBin(bins[flagAt], size)}
          </span>
        )}
      </div>
      <div className="timeline-histogram__axis">
        {bins.map((b, i) =>
          i % ticks === 0 ? (
            <span key={b.start} className={Classes.TEXT_MUTED} style={{ left: `${(i / bins.length) * 100}%` }}>
              {formatAt(b.start, size)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Every event of the subject by day across the whole span, the zoom as a bracket; drag across it to zoom. */
function Overview({ events, from, until, onZoom }: { events: TimelineEvent[]; from: number; until: number; onZoom: (a: number, b: number) => void }) {
  const times = events.map((e) => Date.parse(e.at)).filter(Number.isFinite);
  const first = Math.min(...times);
  const last = Math.max(...times);
  const days = useMemo(() => makeBins(events, first, last, 'day'), [events, first, last]);
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const max = Math.max(1, ...days.map((d) => d.total));
  const span = Math.max(1, days[days.length - 1]?.end - days[0]?.start);
  const left = ((from - days[0]?.start) / span) * 100;
  const width = ((until - from) / span) * 100;
  const finish = () => {
    const d = dragRef.current;
    setDrag(null);
    if (!d) return;
    onZoom(days[Math.min(d.a, d.b)].start, days[Math.max(d.a, d.b)].end - 1);
  };
  return (
    <div className="timeline-overview">
      <span className={`timeline-overview__label ${Classes.TEXT_MUTED}`}>All</span>
      <div className="timeline-overview__strip" onMouseUp={finish} onMouseLeave={() => setDrag(null)}>
        {days.map((d, i) => (
          <div
            key={d.start}
            className={`timeline-overview__day${drag && i >= Math.min(drag.a, drag.b) && i <= Math.max(drag.a, drag.b) ? ' timeline-overview__day--dragged' : ''}`}
            onMouseDown={(e) => (e.preventDefault(), setDrag({ a: i, b: i }))}
            onMouseEnter={() => setDrag((x) => (x ? { ...x, b: i } : x))}
          >
            {d.total > 0 && <span className={d.flagged ? 'timeline-overview__bar timeline-overview__bar--flagged' : 'timeline-overview__bar'} style={{ height: `${20 + (d.total / max) * 80}%` }} />}
          </div>
        ))}
        <span className="timeline-overview__bracket" style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100, Math.max(0.8, width))}%` }} aria-hidden="true" />
      </div>
      <span className={`timeline-overview__ends ${Classes.TEXT_MUTED}`}>
        <span>{dayFormat.format(first)}</span>
        <span>{dayFormat.format(last)}</span>
      </span>
    </div>
  );
}

function EventTable({ events, picked, onPick }: { events: TimelineEvent[]; picked: string | null; onPick: (id: string) => void }) {
  let lastDay = '';
  return (
    <div className="timeline__table-scroll">
      <table className="timeline-table">
        <thead>
          <tr>
            {['Date', 'Time', 'Tag', 'Event', 'Kind', 'Confidence', 'Status'].map((h) => (
              <th key={h}>
                <span className="caps-heading">{h}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const t = Date.parse(e.at);
            const day = dayFormat.format(t);
            const showDay = day !== lastDay;
            lastDay = day;
            const flag = isFlag(e);
            const doubt = (e.confidence != null && e.confidence < 0.9) || e.status === 'review';
            return (
              <tr key={e.id} className={['timeline-row', flag && 'timeline-row--flag', picked === e.id && 'timeline-row--picked'].filter(Boolean).join(' ')} onClick={() => onPick(e.id)} tabIndex={0} onKeyDown={(k) => k.key === 'Enter' && onPick(e.id)}>
                <td className="timeline-row__date">{showDay ? day : ''}</td>
                <td className={dateOnly(e.at) ? Classes.TEXT_MUTED : ''}>{dateOnly(e.at) ? 'date only' : formatClock(t)}</td>
                <td>
                  <span className={`timeline-tag timeline-tag--${e.tag}`}>{TAG_WORDS[e.tag]}</span>
                </td>
                <td className="timeline-row__event">
                  {flag && <WarningSign className="timeline-row__warn" />}
                  <EventPhoto kind={e.kind} objectIds={e.objectIds} />
                  {e.summary}
                </td>
                <td className={Classes.TEXT_MUTED}>{e.kind}</td>
                <td className={doubt && e.confidence != null ? 'timeline-row__doubt' : ''}>{e.confidence != null ? e.confidence.toFixed(2) : ''}</td>
                <td className={e.status && e.status !== 'confirmed' ? 'timeline-row__doubt' : Classes.TEXT_MUTED}>{flag ? 'flagged' : e.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!events.length && <p className={`${Classes.TEXT_MUTED} timeline__none`}>No events in this range.</p>}
    </div>
  );
}

/** The objects an event touches, by name. */
function useObjectTitles(ids: string[]) {
  return useAsync(
    async (dc) =>
      Promise.all(
        ids.map(async (id) => {
          const r = parseKey(id);
          if (!r) return { id, title: id, type: '' };
          const v = await getObjectView(dc, r.type, r.pk).catch(() => null);
          return { id, title: v?.title ?? r.pk, type: r.type };
        }),
      ),
    ids.join('|'),
  );
}

function EventPanel({ event, investigation, onClose }: { event: TimelineEvent | null; investigation: string; onClose: () => void }) {
  const passages = usePassageFiles(event?.passageIds ?? []);
  const objects = useObjectTitles(event?.objectIds ?? []);
  if (!event) {
    return (
      <aside className="timeline-panel" aria-label="Event">
        <div className="timeline-panel__head">
          <span className="timeline-panel__title">Event</span>
        </div>
        <p className={`${Classes.TEXT_MUTED} timeline-panel__hint`}>Click an event in the table to see it here.</p>
      </aside>
    );
  }
  const t = Date.parse(event.at);
  const flag = isFlag(event);
  const record = event.id.startsWith('audit:') ? 'Audit log' : (parseKey(event.id)?.type ?? '');
  const openInGraph = () => {
    const keys = event.objectIds.filter((k) => parseKey(k));
    const nodes = keys.map((k, i) => ({ key: k, ...parseKey(k)!, x: i * 240, y: 0 }));
    navigate(`${viewHref(investigation, 'graph')}?${new URLSearchParams({ focus: keys[0] ?? '', nodes: encodeNodes(nodes) })}`);
  };
  return (
    <aside className="timeline-panel" aria-label="Event">
      <div className="timeline-panel__head">
        <span className="timeline-panel__title">Event</span>
        <Button variant="minimal" icon={<Cross />} aria-label="Close the event" onClick={onClose} />
      </div>
      <div className="timeline-panel__body">
        <div className="timeline-panel__tags">
          <span className={`timeline-tag timeline-tag--${event.tag}`}>{TAG_WORDS[event.tag]}</span>
          <span className="timeline-tag">{event.kind}</span>
          {flag && <span className="timeline-panel__flag">Flagged</span>}
        </div>
        <h5 className="timeline-panel__summary">{event.summary}</h5>
        <dl className="timeline-panel__facts">
          <dt className={Classes.TEXT_MUTED}>When</dt>
          <dd>{dateOnly(event.at) ? `${dayFormat.format(t)}, date only` : longFormat.format(t)}</dd>
          <dt className={Classes.TEXT_MUTED}>UTC</dt>
          <dd>{utcFormat.format(t)}</dd>
          {event.confidence != null && (
            <>
              <dt className={Classes.TEXT_MUTED}>Confidence</dt>
              <dd>{event.confidence.toFixed(2)}</dd>
            </>
          )}
          {(event.status || flag) && (
            <>
              <dt className={Classes.TEXT_MUTED}>Status</dt>
              <dd>{flag ? 'flagged by the system' : event.status}</dd>
            </>
          )}
          <dt className={Classes.TEXT_MUTED}>Record</dt>
          <dd>{record}</dd>
        </dl>

        <div className="timeline-panel__section">
          <H6 className={`caps-heading ${Classes.TEXT_MUTED}`}>Passage</H6>
          <span className={Classes.TEXT_MUTED}>{formatCount(event.passageIds.length)}</span>
        </div>
        {!event.passageIds.length ? (
          <p className={`${Classes.TEXT_MUTED} timeline-panel__hint`}>No passage is cited for this event.</p>
        ) : !passages.data ? (
          <Spinner size={18} />
        ) : (
          passages.data.map((p) => (
            <Fragment key={p.pk}>
              <Blockquote className="timeline-panel__quote">{p.text}</Blockquote>
              <span className={Classes.TEXT_MUTED}>
                {p.fileName}
                {p.index != null ? `, passage ${p.index + 1}` : ''}
              </span>
              <AnchorButton variant="minimal" icon={<Document />} className="timeline-panel__link" text="Open in Files" href={filesHref(p.investigation || investigation, p.documentId, p.pk)} onClick={follow(filesHref(p.investigation || investigation, p.documentId, p.pk))} />
            </Fragment>
          ))
        )}

        <div className="timeline-panel__section">
          <H6 className={`caps-heading ${Classes.TEXT_MUTED}`}>Objects</H6>
          <span className={Classes.TEXT_MUTED}>{formatCount(event.objectIds.length)}</span>
        </div>
        <div className="timeline-panel__chips">
          {(objects.data ?? event.objectIds.map((id) => ({ id, title: parseKey(id)?.pk ?? id, type: parseKey(id)?.type ?? '' }))).map((o) => {
            const ObjIcon = typeIcon(o.type);
            const href = `${viewHref(investigation, 'browser')}?${new URLSearchParams({ object: o.id })}`;
            return <AnchorButton key={o.id} className="timeline-panel__chip" icon={<ObjIcon />} text={o.title} href={href} onClick={follow(href)} />;
          })}
        </div>
        {event.objectIds.length > 0 && <Button className="timeline-panel__graph" icon={<GraphIcon />} text="Open these in Graph" alignText="start" fill onClick={openInGraph} />}
      </div>
    </aside>
  );
}

