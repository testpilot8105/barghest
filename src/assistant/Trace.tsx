// How an answer was reached, folded to one line above it: the words searched for, the records found, the path walked
// in the graph between them, the passages gathered, the model's call and the citation check (owner, 10.10.2026). Every
// step is read from the reply; nothing is timed or invented after the fact. While a question is out the screen still
// waits on one call; the steps arrive live once plumbing's ask reports them as it goes.
import { useState } from 'react';
import { Button, Collapse } from '@blueprintjs/core';
import { CaretDown, CaretRight, Tick, WarningSign } from '@blueprintjs/icons';
import type { AskObject, AskReply } from './ask';

/** The engine's detail on an object it added because it lies on the path between the two ends. */
const ON_PATH = 'on the path';

export interface TraceStep {
  text: string;
  warn?: boolean;
  seconds?: number | null;
}

const count = (n: number, one: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : `${one}s`}`;
/** Titles can hold commas ("ABALOS, Lorna"), so a list of them is split by semicolons. */
const names = (titles: string[]) => (titles.length <= 3 ? titles.join('; ') : `${titles.slice(0, 3).join('; ')} and ${titles.length - 3} more`);
/** A type's apiName as a word: DigitalAccount is "digital account", LGU stays LGU. */
const typeWord = (type: string) => (/^[A-Z]+$/.test(type) ? type : type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());

/** The records found by a type word, per type: the engine keeps the most linked of each. */
function byTypeText(typed: AskObject[]): string {
  const per = new Map<string, number>();
  for (const o of typed) per.set(o.type, (per.get(o.type) ?? 0) + 1);
  return [...per].map(([type, n]) => (n === 1 ? `the most linked ${typeWord(type)}` : `the ${n} most linked ${typeWord(type)}s`)).join(' and ');
}

export function traceOf(reply: AskReply, seconds: number | null): { summary: string; steps: TraceStep[] } {
  const { terms, semantic, passages } = reply.retrieval;
  const found = reply.objects.filter((o) => o.detail !== ON_PATH);
  const onPath = reply.objects.filter((o) => o.detail === ON_PATH);
  const links = reply.relationships.length;
  const steps: TraceStep[] = [];

  steps.push({ text: terms.length ? `Searched for ${terms.join(', ')}` : 'The question names nothing to search for' });
  const named = found.filter((o) => !o.byType);
  const typed = found.filter((o) => o.byType);
  const foundText = [named.length ? names(named.map((o) => o.title)) : '', typed.length ? byTypeText(typed) : ''].filter(Boolean).join(' and ');
  steps.push({ text: found.length ? `Found ${foundText}` : 'Found no record named in the question' });
  // The engine walks the graph between the first record named and the first found by a type word, else the first two.
  const ends = named.length && typed.length ? [named[0], typed[0]] : found.slice(0, 2);
  if (ends.length === 2) {
    const [from, to] = ends;
    steps.push({
      text: links
        ? `Walked the graph from ${from.title} to ${to.title}: ${count(links, 'link')}${onPath.length ? ` through ${names(onPath.map((o) => o.title))}` : ''}`
        : `No path in the graph from ${from.title} to ${to.title}`,
    });
  }
  steps.push({ text: passages ? `Gathered ${count(passages, 'passage')}${semantic ? `, ${semantic} matched by meaning` : ' by keyword and from links'}` : 'No passage holds those words' });
  if (reply.model) {
    const tokens = reply.promptTokens != null && reply.outputTokens != null ? ` (read ${count(reply.promptTokens, 'token')}, wrote ${reply.outputTokens.toLocaleString('en-US')})` : '';
    steps.push({
      text: `${reply.model} ${reply.refused ? 'found no answer in the passages' : 'wrote the answer on this Mac'}${tokens}`,
      warn: reply.refused,
      seconds: reply.latencyMs != null ? reply.latencyMs / 1000 : null,
    });
    if (reply.citations.length) {
      const verbatim = reply.citations.filter((c) => c.verbatim).length;
      const rest = reply.citations.length - verbatim;
      steps.push({ text: `Checked ${count(reply.citations.length, 'citation')} against the passages: ${verbatim} verbatim${rest ? `, ${rest} paraphrased` : ''}` });
    }
  } else if (passages) {
    steps.push({ text: 'The local model is off: no answer written', warn: true });
  } else {
    steps.push({ text: 'With nothing to read, the model was not asked' });
  }

  const time = seconds != null && seconds >= 1 ? `${seconds} s` : 'under a second';
  const parts = [count(found.length, 'record')];
  if (links) parts.push(`a ${links}-link path`);
  parts.push(count(passages, 'passage'));
  const how = reply.model ? `${reply.model} on this Mac in ${time}` : passages ? `found by keyword in ${time}` : `in ${time}`;
  return { summary: `${parts.join(', ')}, ${how}`, steps };
}

export function Trace({ reply, seconds }: { reply: AskReply; seconds: number | null }) {
  const [open, setOpen] = useState(false);
  const { summary, steps } = traceOf(reply, seconds);
  return (
    <div className="assistant-trace">
      <Button
        variant="minimal"
        className="assistant-trace__toggle"
        icon={open ? <CaretDown /> : <CaretRight />}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="bp6-text-muted">How this was answered:</span> {summary}
      </Button>
      <Collapse isOpen={open}>
        <ol className="assistant-trace__steps">
          {steps.map((s, i) => (
            <li key={i} className="assistant-trace__step">
              {s.warn ? <WarningSign className="assistant-trace__warn" /> : <Tick className="assistant-trace__ok" />}
              <span className="assistant-trace__text">{s.text}</span>
              {s.seconds != null && <span className="bp6-text-muted assistant-trace__seconds">{s.seconds.toFixed(1)} s</span>}
            </li>
          ))}
        </ol>
      </Collapse>
    </div>
  );
}
