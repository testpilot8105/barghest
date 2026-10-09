// The Assistant's one engine call and the reply it reads, as docs/engine-api.md section 3 gives them. Until plumbing's
// `ask(dc, { question, investigation })` lands in src/data/ ("hooks are in"), this posts to the same route through the
// data client; swap the body for that function then, the shape stays.
import { enginePost, type DataClient } from '../data/client.ts';

export interface AskObject {
  type: string;
  pk: string;
  title: string;
  detail: string;
}

export interface AskCitation {
  passageId: string;
  quote: string;
  /** Absent with the model off: the passage was found by keyword, not quoted by a model. */
  verbatim?: boolean;
}

export interface AskReply {
  question: string;
  answer: string;
  objects: AskObject[];
  relationships: unknown[];
  citations: AskCitation[];
  refused: boolean;
  retrieval: { terms: string[]; semantic: number; passages: number };
  /** The model that answered, or null when none was asked. */
  model: string | null;
  latencyMs?: number;
}

export function ask(dc: DataClient, req: { question: string; investigation: string }): Promise<AskReply> {
  return enginePost<AskReply>(dc, '/barghest/ask', {}, { question: req.question, investigation: req.investigation });
}

/** One question in the open conversation: waiting while neither `reply` nor `error` is set. */
export interface Turn {
  id: number;
  question: string;
  at: Date;
  /** Measured on this screen, from Ask to the reply. */
  seconds: number | null;
  reply: AskReply | null;
  error: string | null;
}

/** How a reply reads: an answer, the keyword records the engine found with the model off, or nothing found. */
export function replyKind(reply: AskReply): 'answer' | 'keyword' | 'none' {
  if (reply.refused && reply.citations.length === 0) return 'none';
  if (reply.model === null) return 'keyword';
  return 'answer';
}
