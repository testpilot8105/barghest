// The investigation's conversations, each one a saved item of kind `conversation` (engine-api.md 2.10): a file in the
// investigation with a name, a folder and an address (`?saved=<id>`) that a rename never changes. The body is this
// screen's: `{ turns }`, every settled question with its reply. A question still out lives only here until it settles,
// then the whole body is saved in one call, so a reload brings back everything that was answered. Nothing goes to
// browser storage.
import { useEffect, useSyncExternalStore } from 'react';
import { createSaved, deleteSaved, getSaved, updateSaved, useDataClient, useSaved, useSavedItem, type DataClient, type EngineError, type SavedItem } from '../data/index.ts';
import { findView } from '../shell/nav';
import type { AskReply, Turn } from './ask';

/** The name a conversation carries before anything names it: New from Files or a home page. */
const UNTITLED = findView('assistant')?.untitled ?? 'New conversation';
const isUntitled = (name: string) => name === UNTITLED || /^untitled\b/i.test(name);

export interface ConversationRow {
  id: string;
  name: string;
  /** Unknown until its body has been read. */
  questions: number | null;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  name: string;
  /** Settled turns, then any still waiting for a reply. */
  turns: Turn[];
}

interface SavedTurn {
  id: number;
  question: string;
  at: string;
  seconds: number | null;
  reply: AskReply | null;
  error: string | null;
}

// The settled turns as last saved or read, per conversation, with the `updatedAt` they belong to; and the questions
// still out. Only this tab writes a conversation while it is open, so the cache is the truth once seeded.
const saved = new Map<string, Turn[]>();
const savedAt = new Map<string, string>();
const pending = new Map<string, Turn[]>();
const reading = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

function changed() {
  version++;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const useVersion = () => useSyncExternalStore(subscribe, () => version);

const toTurn = (t: SavedTurn): Turn => ({ ...t, at: new Date(t.at) });
const toSaved = (t: Turn): SavedTurn => ({ id: t.id, question: t.question, at: t.at.toISOString(), seconds: t.seconds, reply: t.reply, error: t.error });

/** Read an item's turns into the cache, unless what the cache holds is as new or newer. */
function seed(item: SavedItem) {
  const at = savedAt.get(item.id);
  if (at && at >= item.updatedAt) return;
  const body = item.body as { turns?: SavedTurn[] } | undefined;
  saved.set(item.id, Array.isArray(body?.turns) ? body.turns.map(toTurn) : []);
  savedAt.set(item.id, item.updatedAt);
  changed();
}

export interface ConversationList {
  rows: ConversationRow[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/** This investigation's conversations, the most recently changed first, each with how many questions it holds. */
export function useConversationList(investigation: string): ConversationList {
  const { dc } = useDataClient();
  const list = useSaved(investigation, 'conversation');
  useVersion();
  const items = list.data?.items ?? [];

  // The list carries no bodies; read each one the cache does not hold at its current version, once.
  useEffect(() => {
    if (!dc) return;
    for (const item of items) {
      const at = savedAt.get(item.id);
      if ((at && at >= item.updatedAt) || reading.has(item.id)) continue;
      reading.add(item.id);
      getSaved(dc, item.id)
        .then(seed)
        .catch(() => undefined)
        .finally(() => reading.delete(item.id));
    }
  }, [dc, items]);

  const rows = items.map((item) => ({
    id: item.id,
    name: item.name,
    questions: saved.has(item.id) ? saved.get(item.id)!.length + (pending.get(item.id)?.length ?? 0) : null,
    updatedAt: new Date(item.updatedAt),
  }));
  return { rows, loading: list.loading, error: list.error, reload: list.reload };
}

export interface OpenConversation {
  conversation: Conversation | null;
  /** Its turns are read, so a new question can be added to them. */
  ready: boolean;
  /** The address names a conversation the engine no longer has. */
  missing: boolean;
  reload: () => void;
}

/** The conversation in `?saved=`, with its settled turns and the questions still out. */
export function useConversation(id: string | null): OpenConversation {
  const item = useSavedItem(id);
  useVersion();
  useEffect(() => {
    if (item.data && item.data.id === id) seed(item.data);
  }, [item.data, id]);
  const missing = !!id && (item.error as EngineError | null)?.status === 404;
  if (!id || !item.data || item.data.id !== id) return { conversation: null, ready: false, missing, reload: item.reload };
  const turns = [...(saved.get(id) ?? []), ...(pending.get(id) ?? [])];
  return { conversation: { id, name: item.data.name, turns }, ready: saved.has(id), missing, reload: item.reload };
}

/** A new conversation, named by its first question, saved at the investigation's top level. Returns its id. */
export async function startConversation(dc: DataClient, investigation: string, first: Turn): Promise<string> {
  const item = await createSaved(dc, { investigation, kind: 'conversation', name: first.question, body: { turns: [] } });
  saved.set(item.id, []);
  savedAt.set(item.id, item.updatedAt);
  pending.set(item.id, [first]);
  changed();
  return item.id;
}

export function addTurn(id: string, turn: Turn) {
  pending.set(id, [...(pending.get(id) ?? []), turn]);
  changed();
}

/**
 * The reply or the error for one turn, saved with the conversation's other turns, wherever the screen has moved on to
 * meanwhile. A conversation still carrying its untitled name (New from Files) takes its first question as its name.
 */
export async function settleTurn(dc: DataClient, id: string, turnId: number, patch: Partial<Turn>, name: string | null): Promise<void> {
  const waiting = pending.get(id) ?? [];
  const turn = waiting.find((t) => t.id === turnId);
  if (!turn) return;
  const before = saved.get(id) ?? [];
  const turns = [...before, { ...turn, ...patch }];
  saved.set(id, turns);
  pending.set(id, waiting.filter((t) => t.id !== turnId));
  changed();
  const rename = name != null && before.length === 0 && isUntitled(name) ? { name: turn.question } : {};
  const item = await updateSaved(dc, id, { body: { turns: turns.map(toSaved) }, ...rename });
  savedAt.set(id, item.updatedAt);
}

/** An empty name goes back to the first question. */
export async function renameConversation(dc: DataClient, id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  const fallback = saved.get(id)?.[0]?.question ?? UNTITLED;
  const item = await updateSaved(dc, id, { name: trimmed || fallback });
  savedAt.set(id, item.updatedAt);
}

export async function deleteConversation(dc: DataClient, id: string): Promise<void> {
  await deleteSaved(dc, id);
  saved.delete(id);
  savedAt.delete(id);
  pending.delete(id);
  changed();
}
