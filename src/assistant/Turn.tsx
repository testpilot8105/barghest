// One question in the conversation and what came back: the answer with the objects it names on the left, the passages
// it cites on the right. A model-off reply shows what keyword search found and never reads as an answer; a reply with
// nothing behind it says what was searched for.
import { useEffect, useState, type ComponentType, type MouseEvent } from 'react';
import { Callout, Spinner, Tag, type Intent } from '@blueprintjs/core';
import {
  At,
  Box,
  Calendar,
  Clipboard,
  Comment,
  Cube,
  Disable,
  Document,
  DriveTime,
  Flag,
  Issue,
  Learning,
  Manual,
  Map as MapIcon,
  MapMarker,
  Office,
  People,
  Person,
  Target,
  Truck,
  type SVGIconProps,
} from '@blueprintjs/icons';
import { DOCUMENT_PARAM, navigate, OBJECT_PARAM, viewHref } from '../shell/route';
import { replyKind, type AskCitation, type AskObject, type AskReply, type Turn } from './ask';
import { useCitedPassages, type CitedPassage } from './reads';

const TYPE_ICON: Record<string, ComponentType<SVGIconProps>> = {
  Person,
  DigitalAccount: At,
  OnlineGroup: People,
  Organization: Office,
  Location: MapMarker,
  Event: Calendar,
  Incident: Issue,
  Firearm: Target,
  EvidenceItem: Box,
  School: Learning,
  LGU: Flag,
  Barangay: MapIcon,
  Hauler: Truck,
  Contract: Manual,
  Facility: Office,
  Vehicle: DriveTime,
  Inspection: Clipboard,
  Complaint: Comment,
  Document,
};

/** A plain click follows the link inside the app; a modified click is left to the browser (new tab). */
function follow(href: string) {
  return (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
}

const clock = (at: Date) => at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function TurnView({ turn, investigation, modelOff }: { turn: Turn; investigation: string; modelOff: boolean }) {
  const { reply, error } = turn;
  return (
    <article className="assistant-turn">
      <div className="assistant-turn__question">
        <p className="assistant-turn__asked">{turn.question}</p>
        <span className="bp6-text-muted">{clock(turn.at)}</span>
      </div>
      {error ? (
        <Callout intent="danger" compact>
          The question didn't reach the engine: {error}
        </Callout>
      ) : reply ? (
        <Reply reply={reply} seconds={turn.seconds} investigation={investigation} />
      ) : (
        <Waiting modelOff={modelOff} />
      )}
    </article>
  );
}

function Waiting({ modelOff }: { modelOff: boolean }) {
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(started);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="assistant-wait" role="status">
      <Spinner size={20} />
      <span>{modelOff ? 'Searching this investigation’s files' : 'The local model on this Mac is reading the passages'}</span>
      <span className="bp6-text-muted assistant-wait__seconds">{Math.floor((now - started) / 1000)} s</span>
    </div>
  );
}

function Reply({ reply, seconds, investigation }: { reply: AskReply; seconds: number | null; investigation: string }) {
  const kind = replyKind(reply);
  const terms = reply.retrieval.terms;
  return (
    <div className="assistant-turn__body">
      <div className="assistant-turn__answer">
        {kind === 'none' ? (
          <Callout icon={<Disable />} title="No supporting records">
            {terms.length
              ? `Searched this investigation’s files for: ${terms.join(', ')}`
              : 'The question names nothing to search for. Name a person, place, file or number in it.'}
          </Callout>
        ) : (
          <>
            <h6 className="caps-heading">Answer</h6>
            {kind === 'keyword' ? (
              <p className="bp6-text-muted">No answer. Searched for: {terms.join(', ')}</p>
            ) : (
              <>
                <p className="assistant-turn__text">{reply.answer}</p>
                <p className="bp6-text-muted">
                  Answered on this machine by {reply.model} in {seconds != null && seconds >= 1 ? `${seconds} s` : 'under a second'}
                </p>
              </>
            )}
          </>
        )}
        {reply.objects.length > 0 && (
          <>
            <h6 className="caps-heading">Objects</h6>
            <div className="assistant-turn__objects">
              {reply.objects.map((o) => (
                <ObjectChip key={`${o.type}:${o.pk}`} object={o} investigation={investigation} />
              ))}
            </div>
          </>
        )}
      </div>
      {reply.citations.length > 0 && <Citations citations={reply.citations} keyword={kind === 'keyword'} investigation={investigation} />}
    </div>
  );
}

function ObjectChip({ object, investigation }: { object: AskObject; investigation: string }) {
  const Icon = TYPE_ICON[object.type] ?? Cube;
  const href = `${viewHref(investigation, 'browser')}?${new URLSearchParams({ [OBJECT_PARAM]: `${object.type}:${object.pk}` })}`;
  return (
    <a className="assistant-chip" href={href} onClick={follow(href)}>
      <Tag size="large" minimal icon={<Icon />}>
        {object.title}
      </Tag>
    </a>
  );
}

function Citations({ citations, keyword, investigation }: { citations: AskCitation[]; keyword: boolean; investigation: string }) {
  const passages = useCitedPassages(citations.map((c) => c.passageId));
  return (
    <div className="assistant-turn__citations">
      <h6 className="caps-heading">{keyword ? 'Found by keyword' : 'Citations'}</h6>
      {citations.map((c, i) => (
        <Citation key={`${c.passageId}-${i}`} n={i + 1} citation={c} passage={passages.data?.get(c.passageId)} investigation={investigation} />
      ))}
    </div>
  );
}

const TAG: Record<'verbatim' | 'paraphrased' | 'keyword', [string, Intent]> = {
  verbatim: ['Verbatim', 'success'],
  paraphrased: ['Paraphrased', 'warning'],
  keyword: ['Keyword match', 'none'],
};

function Citation({ n, citation, passage, investigation }: { n: number; citation: AskCitation; passage: CitedPassage | undefined; investigation: string }) {
  const how = citation.verbatim === true ? 'verbatim' : citation.verbatim === false ? 'paraphrased' : 'keyword';
  const [label, intent] = TAG[how];
  const quote = how === 'verbatim' ? `“${citation.quote}”` : citation.quote;
  const body = (
    <>
      <span className="assistant-cite__source">
        <span className="assistant-cite__n">{n}</span>
        <Document />
        <span className="bp6-text-muted assistant-cite__label">{passage?.label ?? citation.passageId}</span>
        <Tag size="large" minimal intent={intent}>
          {label}
        </Tag>
      </span>
      <span className="assistant-cite__quote">{quote}</span>
    </>
  );
  if (!passage?.documentId) return <div className="assistant-cite">{body}</div>;
  const href = `${viewHref(investigation, 'files')}?${new URLSearchParams({ [DOCUMENT_PARAM]: passage.documentId, passage: citation.passageId })}`;
  return (
    <a className="assistant-cite" href={href} onClick={follow(href)}>
      {body}
    </a>
  );
}
