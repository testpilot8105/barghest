// The Timeline's histogram as data: the shown range cut into bins (hours for three days or less, days up to three
// months, weeks beyond), each counting its events by tag. Bins follow this machine's clock, as every date in the app
// does.
import type { TimelineEvent, TimelineTag } from '../graph/bridge';

export type BinSize = 'hour' | 'day' | 'week';

export const TAGS: readonly TimelineTag[] = ['observed', 'system', 'analyst'];

export interface Bin {
  start: number;
  end: number;
  counts: Record<TimelineTag, number>;
  total: number;
  /** a Relationship the system flagged (the deletion gap) falls in this bin */
  flagged: boolean;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function binSizeFor(span: number): BinSize {
  if (span <= 3 * DAY) return 'hour';
  if (span <= 92 * DAY) return 'day';
  return 'week';
}

export function floorTo(t: number, size: BinSize): number {
  const d = new Date(t);
  if (size === 'hour') return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Weeks start on Monday.
  if (size === 'week') day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day.getTime();
}

export function step(t: number, size: BinSize): number {
  const d = new Date(t);
  if (size === 'hour') return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (size === 'week' ? 7 : 1)).getTime();
}

/** A system event that is a flagged Relationship, not an engine action from the audit log. */
export function isFlag(e: TimelineEvent): boolean {
  return e.tag === 'system' && e.id.startsWith('Relationship:');
}

export function makeBins(events: TimelineEvent[], from: number, until: number, size: BinSize): Bin[] {
  const bins: Bin[] = [];
  for (let t = floorTo(from, size); t <= until && bins.length < 500; t = step(t, size)) {
    bins.push({ start: t, end: step(t, size), counts: { observed: 0, system: 0, analyst: 0 }, total: 0, flagged: false });
  }
  for (const e of events) {
    const at = Date.parse(e.at);
    const bin = bins.find((b) => at >= b.start && at < b.end);
    if (!bin) continue;
    bin.counts[e.tag] += 1;
    bin.total += 1;
    if (isFlag(e)) bin.flagged = true;
  }
  return bins;
}

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const fullDay = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function formatClock(t: number): string {
  return clock.format(t);
}

export function formatDay(t: number): string {
  return fullDay.format(t);
}

/** A moment, as precise as the bins are. */
export function formatAt(t: number, size: BinSize): string {
  if (size === 'hour') return `${dayMonth.format(t)} ${clock.format(t)}`;
  return size === 'day' ? dayMonth.format(t) : dayMonthYear.format(t);
}

/** One bin's span, in words: "13 Sep, 14:00 to 15:00", "13 Sep", "the week of 7 Sep 2026". */
export function formatBin(bin: Bin, size: BinSize): string {
  if (size === 'hour') return `${dayMonth.format(bin.start)}, ${clock.format(bin.start)} to ${clock.format(bin.end)}`;
  return size === 'day' ? dayMonthYear.format(bin.start) : `the week of ${dayMonthYear.format(bin.start)}`;
}

export function formatRange(from: number, until: number): string {
  return `${dayMonthYear.format(from)} ${clock.format(from)} to ${dayMonthYear.format(until)} ${clock.format(until)}`;
}

export const BIN_WORDS: Record<BinSize, string> = { hour: 'hours', day: 'days', week: 'weeks' };
