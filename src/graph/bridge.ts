// A stand-in for two data-layer hooks plumbing has promised (hooks addendum, section 1): useWhatConnects and
// useTimeline, over the engine's `what-connects` and `timeline` routes (engine-api section 3). They read through
// src/data's own client, so nothing here talks to the engine on its own. When plumbing says "hooks are in", the two
// views import the real hooks from src/data instead and this file is deleted.
import { useAsync, type AsyncState, type DataClient } from '../data/index.ts';
import { engineGet } from '../data/client.ts';

export interface PathObject {
  type: string;
  pk: string;
  title: string;
}

export interface PathRelationship {
  pk: string;
  label: string;
  kind: string;
  confidence: number | null;
  status: string;
  method: string;
  observedAt: string | null;
  from: { type: string; pk: string };
  to: { type: string; pk: string };
  passageIds: string[];
}

export interface PathStep {
  from: string;
  link: string;
  to: string;
}

export interface ConnectionPath {
  hops: number;
  objects: PathObject[];
  relationships: PathRelationship[];
  steps: PathStep[];
}

export interface WhatConnectsResult {
  from: string;
  to: string;
  found: boolean;
  hops: number | null;
  paths: ConnectionPath[];
  objects: PathObject[];
  relationships: PathRelationship[];
  passages: Array<{ pk: string; documentId: string; label: string; text: string }>;
}

export type TimelineTag = 'observed' | 'system' | 'analyst';

export interface TimelineEvent {
  id: string;
  at: string;
  kind: string;
  summary: string;
  tag: TimelineTag;
  confidence: number | null;
  status: string;
  objectIds: string[];
  passageIds: string[];
}

export interface TimelineResult {
  objectId: string;
  hops: number;
  /** how many objects the walk reached */
  objects: number;
  events: TimelineEvent[];
}

/** Up to five shortest paths between two objects, each given as "Type:pk". Nothing is asked while either is null. */
export function useWhatConnects(from: string | null, to: string | null): AsyncState<WhatConnectsResult> {
  return useAsync(
    (dc) => (from && to ? engineGet<WhatConnectsResult>(dc, '/barghest/what-connects', { from, to }) : Promise.reject(new Error('no path asked'))),
    `${from ?? ''}>${to ?? ''}`,
  );
}

/** Everything dated within `hops` of an object ("Type:pk"), in time order. */
export function useTimeline(objectId: string | null, hops: number): AsyncState<TimelineResult> {
  return useAsync(
    (dc) => (objectId ? engineGet<TimelineResult>(dc, '/barghest/timeline', { objectId, hops: String(hops) }) : Promise.reject(new Error('no object'))),
    `${objectId ?? ''}|${hops}`,
  );
}

/** One object's timeline, as the route gives it. */
export function getTimeline(dc: DataClient, objectId: string, hops: number): Promise<TimelineResult> {
  return engineGet<TimelineResult>(dc, '/barghest/timeline', { objectId, hops: String(hops) });
}

/**
 * Every dated event that touches the objects on a canvas: each object's own timeline (hops 0: its own date, its
 * relationships and its audit rows), four at a time, merged by event id and kept in time order.
 */
export function useObjectsTimeline(keys: string[]): AsyncState<TimelineEvent[]> {
  const sorted = [...new Set(keys)].sort();
  return useAsync(async (dc) => {
    const seen = new Map<string, TimelineEvent>();
    for (let i = 0; i < sorted.length; i += 4) {
      const batch = await Promise.all(sorted.slice(i, i + 4).map((k) => getTimeline(dc, k, 0).catch(() => null)));
      for (const t of batch) for (const e of t?.events ?? []) seen.set(e.id, e);
    }
    return [...seen.values()].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  }, sorted.join('|'));
}

/** Several subjects' timelines merged by event id, oldest first; `objects` is how many the walk reached from one subject. */
export function useSubjectsTimeline(subjects: string[], hops: number): AsyncState<{ events: TimelineEvent[]; objects: number | null }> {
  return useAsync(async (dc) => {
    const all = await Promise.all(subjects.map((k) => getTimeline(dc, k, hops)));
    const seen = new Map<string, TimelineEvent>();
    for (const t of all) for (const e of t.events) seen.set(e.id, e);
    const events = [...seen.values()].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    return { events, objects: all.length === 1 ? all[0].objects : null };
  }, `${subjects.join('|')}#${hops}`);
}
