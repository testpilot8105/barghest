// The investigation's conversations. Anything a person makes is saved (owner, 09.10.2026): once plumbing's saved hooks
// land (hooks addendum 1b: useSaved, createSaved, updateSaved, deleteSaved with kind `conversation`), each change here
// becomes that call and this module's body is swapped for them; the shape the screen reads stays. Until then the
// conversations last as long as the browser tab, and never go to browser storage.
import { useMemo, useSyncExternalStore } from 'react';
import type { Turn } from './ask';

export interface Conversation {
  id: string;
  investigation: string;
  /** Set by Rename; until then the first question names it. */
  name: string | null;
  turns: Turn[];
  createdAt: Date;
  updatedAt: Date;
}

let all: Conversation[] = [];
const listeners = new Set<() => void>();

function commit(next: Conversation[]) {
  all = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** This investigation's conversations, the most recently used first. */
export function useConversations(investigation: string): Conversation[] {
  const snapshot = useSyncExternalStore(subscribe, () => all);
  return useMemo(
    () => snapshot.filter((c) => c.investigation === investigation).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    [snapshot, investigation],
  );
}

export function conversationName(c: Conversation): string {
  return c.name ?? c.turns[0]?.question ?? 'New conversation';
}

/** A new conversation, started by its first question. */
export function startConversation(investigation: string, first: Turn): Conversation {
  const now = new Date();
  const c: Conversation = { id: Math.random().toString(36).slice(2, 10), investigation, name: null, turns: [first], createdAt: now, updatedAt: now };
  commit([...all, c]);
  return c;
}

function update(id: string, change: (c: Conversation) => Conversation) {
  commit(all.map((c) => (c.id === id ? change(c) : c)));
}

export function addTurn(id: string, turn: Turn) {
  update(id, (c) => ({ ...c, turns: [...c.turns, turn], updatedAt: new Date() }));
}

/** The reply or the error for one turn, wherever the screen has moved on to meanwhile. */
export function settleTurn(id: string, turnId: number, patch: Partial<Turn>) {
  update(id, (c) => ({ ...c, turns: c.turns.map((t) => (t.id === turnId ? { ...t, ...patch } : t)) }));
}

/** An empty name goes back to the first question. */
export function renameConversation(id: string, name: string) {
  const trimmed = name.trim();
  update(id, (c) => ({ ...c, name: trimmed && trimmed !== c.turns[0]?.question ? trimmed : null }));
}

export function deleteConversation(id: string) {
  commit(all.filter((c) => c.id !== id));
}
