// A file, open in Files: the text the model read, passage by passage, beside what it pulled from each one (owner's
// approved mockup, 09.10.2026). The things it found are tags by type that open the object's profile; the links read
// "A kind B" with their confidence. Rows of a table file are listed under the passages. The file's model log runs
// along the foot. `?passage=` scrolls to one passage and outlines it, for the links other views make into a file.
import { AnchorButton, Button, Classes, EditableText, H4, HTMLTable, Intent, NonIdealState, Spinner, Tag } from '@blueprintjs/core';
import { Error as ErrorIcon, Refresh, Share, SmallTick, Trash, WarningSign } from '@blueprintjs/icons';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  EngineError,
  extractAgain,
  fileUrl,
  renameDocument,
  setRegister,
  useCatalog,
  useDataClient,
  useDocumentView,
  type Catalog,
  type DocumentMention,
  type DocumentRelationship,
  type InferenceRow,
} from '../data/index.ts';
import { FormatIcon, useDeleteFile } from '../intake/parts';
import { callLabel, passageNumber } from '../intake/status';
import { toast } from '../intake/toaster';
import { MODEL_OFF, NO_TEXT } from '../intake/useIntake';
import { navigate, viewHref } from '../shell/route';
import { useDocumentTitle } from '../shell/title';

interface FileViewProps {
  investigation: string;
  documentId: string;
  passageId: string | null;
  /** The path to the file's folder, every step a way back. */
  crumbs: ReactNode;
  /** The file's folder, where a delete lands. */
  listHref: string;
  /** After a delete: the list reads its files again before it shows. */
  onDeleted: () => void;
}

export function FileView({ investigation, documentId, passageId, crumbs, listHref, onDeleted }: FileViewProps) {
  const { dc } = useDataClient();
  const view = useDocumentView(documentId);
  const catalog = useCatalog().data;
  const doc = view.data?.document;
  const shown = doc ? String((doc as { name?: string }).name || doc.title) : null;
  const register = doc ? String((doc as { register?: string }).register ?? doc.system ?? '') : '';
  useDocumentTitle(shown);
  const del = useDeleteFile(() => {
    onDeleted();
    navigate(listHref);
  });

  // ?passage=: bring that passage into view once it is on screen.
  const picked = useRef<HTMLDivElement>(null);
  const passageCount = view.data?.passages.length ?? 0;
  useEffect(() => {
    if (passageId && picked.current) picked.current.scrollIntoView({ block: 'center' });
  }, [passageId, passageCount]);

  if (view.error) {
    const missing = view.error instanceof EngineError && view.error.status === 404;
    return (
      <NonIdealState
        icon={<ErrorIcon size={48} />}
        title={missing ? 'This file is not here' : "This file didn't open"}
        description={missing ? 'It may have been deleted.' : view.error.message}
        action={<Button text="Back to the files" onClick={() => navigate(listHref)} />}
      />
    );
  }
  if (!view.data || !doc || !shown) return <Spinner className="file-view__spinner" />;

  const runAgain = () => {
    if (!dc) return;
    extractAgain(dc, documentId)
      .then(view.reload)
      .catch((e: Error) => toast(e instanceof EngineError && e.status === 503 ? MODEL_OFF : `${shown}: ${e.message}`));
  };
  const rename = (next: string) => {
    if (!dc || next.trim() === shown) return;
    if (!next.trim()) return toast("A name can't be empty.");
    renameDocument(dc, documentId, next.trim())
      .then(view.reload)
      .catch((e: Error) => toast(`${shown}: ${e.message}`));
  };
  const reregister = (next: string) => {
    if (!dc || next.trim() === register) return;
    setRegister(dc, documentId, next.trim())
      .then(view.reload)
      .catch((e: Error) => toast(`${shown}: ${e.message}`));
  };
  const objectHref = (m: { type: string; pk: string; canonicalId?: string | null }) =>
    `${viewHref(investigation, 'browser')}?${new URLSearchParams({ object: `${m.type}:${m.canonicalId || m.pk}` })}`;

  return (
    <div className="file-view">
      <header className="file-view__head">
        {crumbs}
        <div className="file-view__row">
          <div className="file-view__name">
            <FormatIcon format={doc.format} />
            <H4>
              <EditableText key={shown} defaultValue={shown} onConfirm={rename} selectAllOnFocus />
            </H4>
            <EditableText key={`r:${register}`} className="file-view__register" defaultValue={register} placeholder="No register" onConfirm={reregister} selectAllOnFocus />
            <FileState status={doc.status} extracting={doc.extracting} />
          </div>
          <div className="file-view__actions">
            {dc && <AnchorButton icon={<Share />} text="Open original" href={fileUrl(dc, documentId)} target="_blank" />}
            <Button icon={<Refresh />} text="Run the model again" disabled={doc.extracting || doc.status === 'no text'} onClick={runAgain} />
            <Button icon={<Trash />} text="Delete" intent={Intent.DANGER} variant="minimal" disabled={doc.extracting} onClick={() => del.ask({ id: documentId, name: shown })} />
          </div>
        </div>
      </header>

      <div className="file-view__body">
        {doc.status === 'no text' && <p className={Classes.TEXT_MUTED}>{NO_TEXT}</p>}
        {view.data.passages.map((p) => {
          const on = p.pk === passageId;
          return (
            <div key={p.pk} ref={on ? picked : undefined} className={`file-pass${on ? ' file-pass--picked' : ''}`}>
              <div className="file-pass__text">
                <span className="caps-heading">Passage {p.index + 1}</span>
                <p>{p.text}</p>
              </div>
              <Pulled catalog={catalog} mentions={p.mentions} links={p.relationships} hrefOf={objectHref} reading={doc.extracting} />
            </div>
          );
        })}
        {view.data.records.length > 0 && (
          <section className="file-view__records">
            <span className="caps-heading">Rows</span>
            <HTMLTable compact className="intake-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th className="file-view__found">Found</th>
                </tr>
              </thead>
              <tbody>
                {view.data.records.map((r) => (
                  <tr key={r.pk}>
                    <td>{r.label}</td>
                    <td>
                      <Mentions catalog={catalog} mentions={r.mentions} hrefOf={objectHref} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          </section>
        )}
      </div>

      <FileLog rows={view.data.inference} />
      {del.alert}
    </div>
  );
}

function FileState({ status, extracting }: { status: string; extracting: boolean }) {
  if (status === 'no text')
    return (
      <Tag intent={Intent.DANGER} minimal size="large">
        No text
      </Tag>
    );
  if (extracting)
    return (
      <span className="intake-status intake-status--reading">
        <Spinner size={16} />
        <span>Reading</span>
      </span>
    );
  if (status === 'extracted')
    return (
      <span className="intake-status">
        <SmallTick color="var(--bp-palette-green-5)" />
        <span className={Classes.TEXT_MUTED}>Done</span>
      </span>
    );
  if (status === 'extracted with gaps')
    return (
      <span className="intake-status intake-status--gaps">
        <WarningSign color="var(--bp-palette-orange-5)" />
        <span>Done with gaps</span>
      </span>
    );
  if (status === 'extraction failed')
    return (
      <Tag intent={Intent.DANGER} minimal size="large">
        Failed
      </Tag>
    );
  return <span className={Classes.TEXT_MUTED}>Not read yet</span>;
}

/** What the model pulled from one passage: the things by type, then the links. */
function Pulled({
  catalog,
  mentions,
  links,
  hrefOf,
  reading,
}: {
  catalog: Catalog | null;
  mentions: DocumentMention[];
  links: DocumentRelationship[];
  hrefOf: (m: DocumentMention) => string;
  reading: boolean;
}) {
  if (!mentions.length && !links.length) return <div className={`file-pass__pulled ${Classes.TEXT_MUTED}`}>{reading ? 'Not read yet.' : 'Nothing found here.'}</div>;
  return (
    <div className="file-pass__pulled">
      <Mentions catalog={catalog} mentions={mentions} hrefOf={hrefOf} grouped />
      {links.length > 0 && (
        <div className="file-found">
          <span className="file-found__label">Links</span>
          <div className="file-found__links">
            {links.map((l) => (
              <div key={l.pk} className="file-link">
                <span>
                  {l.from.title} <span className={Classes.TEXT_MUTED}>{(l.kindLabel || l.kind).replace(/_/g, ' ')}</span> {l.to.title}
                </span>
                {l.confidence != null && <span className={`file-link__conf${l.confidence < 0.9 ? ' file-link__conf--review' : ''}`}>{l.confidence.toFixed(2)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Mentions({ catalog, mentions, hrefOf, grouped = false }: { catalog: Catalog | null; mentions: DocumentMention[]; hrefOf: (m: DocumentMention) => string; grouped?: boolean }) {
  const tag = (m: DocumentMention) => (
    <Tag key={`${m.type}:${m.pk}`} minimal interactive size="large" onClick={() => navigate(hrefOf(m))}>
      {m.title}
    </Tag>
  );
  if (!grouped) return <span className="file-found__tags">{mentions.map(tag)}</span>;
  const byType = new Map<string, DocumentMention[]>();
  for (const m of mentions) byType.set(m.type, [...(byType.get(m.type) ?? []), m]);
  return (
    <>
      {[...byType].map(([type, ms]) => (
        <div key={type} className="file-found">
          <span className="file-found__label">{catalog?.types[type]?.pluralDisplayName ?? type}</span>
          <span className="file-found__tags">{ms.map(tag)}</span>
        </div>
      ))}
    </>
  );
}

/** The file's model calls, newest first, along the foot. */
function FileLog({ rows }: { rows: InferenceRow[] }) {
  const newest = [...rows].reverse();
  return (
    <footer className="file-view__log">
      <span className="caps-heading">Model log</span>
      {!newest.length ? (
        <span className={Classes.TEXT_MUTED}>No model calls yet.</span>
      ) : (
        <div className="file-view__log-rows">
          {newest.map((r) => {
            const at = new Date(r.at);
            const n = passageNumber(r.passageId);
            return (
              <span key={r.id} className={r.ok ? Classes.TEXT_MUTED : 'file-view__log-failed'}>
                {Number.isNaN(at.getTime()) ? '' : at.toLocaleTimeString('en-GB', { hour12: false })} · {callLabel(r.purpose)}
                {n != null ? ` · passage ${n}` : ''} · {(r.latencyMs / 1000).toFixed(1)} s · {r.ok ? `${r.promptTokens ?? '?'} to ${r.outputTokens ?? '?'}` : 'failed'}
              </span>
            );
          })}
        </div>
      )}
    </footer>
  );
}
