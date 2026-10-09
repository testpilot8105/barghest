// The Assistant (S6): questions about one investigation, answered by the local model from its files, every answer
// citing the passages it used. Laid out as the owner approved it in Figma (09.10.2026): the conversations on the left,
// the open conversation on the right with the newest question at the bottom, the input and the model switcher under
// it. `?saved=` names the open conversation, a saved item that survives a reload; `?q=` fills the input and never
// sends.
import { useEffect, useRef, useState } from 'react';
import { Button, Callout, H4, NonIdealState } from '@blueprintjs/core';
import { Chat, WarningSign } from '@blueprintjs/icons';
import { useDataClient, useHealth, useInvestigations } from '../data/index.ts';
import { findView, paletteVar } from '../shell/nav';
import { navigate, useSearchParam, viewHref } from '../shell/route';
import { useDocumentTitle } from '../shell/title';
import { ask, type Turn } from './ask';
import { Composer } from './Composer';
import { ConversationList } from './ConversationList';
import { toast } from '../intake/toaster';
import { addTurn, deleteConversation, renameConversation, settleTurn, startConversation, useConversation, useConversationList } from './conversations';
import { useExamples } from './reads';
import { TurnView } from './Turn';
import './assistant.css';

const questions = (n: number) => `${n} question${n === 1 ? '' : 's'}`;
/** Turn ids only need to differ within a conversation, across reloads too. */
let lastTurn = 0;
const nextTurnId = () => (lastTurn = Math.max(lastTurn + 1, Date.now()));
const failed = (what: string, e: unknown) => toast(`${what}: ${e instanceof Error ? e.message : String(e)}`);

export function Assistant({ investigation }: { investigation: string }) {
  const { dc } = useDataClient();
  const health = useHealth();
  const list = useInvestigations();
  const inv = list.data?.investigations.find((i) => i.id === investigation);
  const examples = useExamples(investigation, inv?.template ?? null);

  const convos = useConversationList(investigation);
  const savedId = useSearchParam('saved');
  const { conversation: open, ready, missing, reload } = useConversation(savedId);
  const turns = open?.turns ?? [];
  const busy = turns.some((t) => !t.reply && !t.error);
  const href = (id: string | null) => (id ? `${viewHref(investigation, 'assistant')}?saved=${id}` : viewHref(investigation, 'assistant'));

  // A conversation the engine no longer has (deleted elsewhere, a stale link) opens a new one in its place.
  useEffect(() => {
    if (missing) navigate(href(null), { replace: true });
  }, [missing]); // eslint-disable-line react-hooks/exhaustive-deps

  const prefill = useSearchParam('q');
  const [draft, setDraft] = useState(prefill ?? '');
  useEffect(() => {
    if (prefill != null) setDraft(prefill);
  }, [prefill]);

  const modelOff = health.data ? health.data.ollama === null : false;
  const model = health.data && !Array.isArray(health.data.models) ? health.data.models.chat : null;

  useDocumentTitle(open ? open.name : null);

  const input = useRef<HTMLTextAreaElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  async function send() {
    const question = draft.trim();
    if (!question || !dc || busy || (savedId && !ready)) return;
    const turn: Turn = { id: nextTurnId(), question, at: new Date(), seconds: null, reply: null, error: null };
    const name = open?.name ?? null;
    let id = open?.id;
    if (id) addTurn(id, turn);
    else {
      try {
        id = await startConversation(dc, investigation, turn);
      } catch (e) {
        failed('The conversation could not be saved', e);
        return;
      }
      navigate(href(id));
    }
    setDraft('');
    convos.reload();
    const started = performance.now();
    let patch: Partial<Turn>;
    try {
      const reply = await ask(dc, { question, investigation });
      patch = { reply, seconds: Math.round((performance.now() - started) / 1000) };
    } catch (e) {
      patch = { error: e instanceof Error ? e.message : String(e) };
    }
    try {
      await settleTurn(dc, id, turn.id, patch, name);
    } catch (e) {
      failed('This answer is shown but not saved', e);
    }
    convos.reload();
    reload();
  }

  function fill(question: string) {
    setDraft(question);
    input.current?.focus();
  }

  const view = findView('assistant');
  return (
    <div className="assistant">
      <ConversationList
        conversations={convos.rows}
        openId={open?.id ?? null}
        onOpen={(id) => navigate(href(id))}
        onNew={() => {
          navigate(href(null));
          setDraft('');
          input.current?.focus();
        }}
        onRename={(id, name) => {
          if (!dc) return;
          renameConversation(dc, id, name)
            .then(() => {
              convos.reload();
              if (id === open?.id) reload();
            })
            .catch((e) => failed('Rename failed', e));
        }}
        onDelete={(id) => {
          if (!dc) return;
          deleteConversation(dc, id)
            .then(() => {
              convos.reload();
              if (id === open?.id) navigate(href(null), { replace: true });
            })
            .catch((e) => failed('Delete failed', e));
        }}
      />

      <section className="assistant-conversation" aria-label="Conversation">
        <header className="assistant-conversation__header">
          <span className="assistant-conversation__title">
            <Chat />
            <H4>Conversation</H4>
          </span>
          <span className="bp6-text-muted">{questions(turns.length)}</span>
        </header>
        {modelOff && (
          <Callout intent="warning" icon={<WarningSign />} compact className="assistant-off">
            {turns.length
              ? 'The local model is off. Answers need it; the records below were found by keyword.'
              : 'The local model is off. Answers need it; asking still finds the records by keyword.'}
          </Callout>
        )}
        <div className="assistant-conversation__thread" ref={thread}>
          {turns.length ? (
            turns.map((t) => <TurnView key={t.id} turn={t} investigation={investigation} modelOff={modelOff} />)
          ) : (
            <NonIdealState
              className="assistant-empty"
              icon={<Chat size={48} color={view ? paletteVar(view.color) : undefined} />}
              title={inv ? `Ask about ${inv.name}` : 'Ask about this investigation'}
              description="Answers come from this investigation’s files and cite the passages they used."
              action={
                examples.data?.length ? (
                  <div className="assistant-examples">
                    {examples.data.map((q) => (
                      <Button key={q} variant="outlined" text={q} onClick={() => fill(q)} />
                    ))}
                  </div>
                ) : undefined
              }
            />
          )}
        </div>
        <Composer
          draft={draft}
          onDraft={setDraft}
          onAsk={send}
          busy={busy || (!!savedId && !ready)}
          placeholder={inv ? `Ask about ${inv.name}` : 'Ask about this investigation'}
          inputRef={input}
          model={model}
          modelOff={modelOff}
        />
      </section>
    </div>
  );
}
