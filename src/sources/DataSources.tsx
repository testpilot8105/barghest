// Data Sources: what's coming in, and is the model done with it (Foundry's Data Connection, in BARGHEST's look). The
// owner's layout B (09.10.2026): a strip across the top saying what the model is doing right now, then the files
// and the model log side by side. The whole view takes dropped files, and shows a pack import filling in.
import { Callout, Classes, H4, HTMLTable, Intent, NonIdealState, ProgressBar, Tag } from '@blueprintjs/core';
import { Database, Error as ErrorIcon, Import, SmallTick, WarningSign } from '@blueprintjs/icons';
import { useEffect, useState } from 'react';
import { fileUrl, useDataClient, useDocumentView, type InferenceRow } from '../data/index.ts';
import { Connecting, EngineDown, formatCount } from '../explorer/parts';
import { useFileActions } from '../intake/fileActions';
import { FileMenu, FitName, FormatIcon, ImportButton, MenuRow, RowMenu, SkeletonRows, StatusCell, useDropZone } from '../intake/parts';
import { aboutLeft, byRegister, callLabel, clock, passageNumber, type IntakeFile } from '../intake/status';
import { MODEL_OFF, useIntake, type Intake } from '../intake/useIntake';
import { useInvestigationList } from '../shell/investigations';
import { fileHref, navigate } from '../shell/route';
import { paletteVar } from '../shell/nav';
import { useDocumentTitle } from '../shell/title';

export function DataSources({ investigation }: { investigation: string }) {
  const { dc, error } = useDataClient();
  const name = useInvestigationList().find(investigation)?.name ?? null;
  useDocumentTitle(name);
  if (error) return <EngineDown />;
  if (!dc) return <Connecting />;
  return <SourcesScreen investigation={investigation} />;
}

function SourcesScreen({ investigation }: { investigation: string }) {
  const intake = useIntake(investigation);
  const drop = useDropZone((files) => intake.importFiles(files));
  const files = [...intake.files].sort(byRegister);
  const totals = sumUp(intake.files);
  const actions = useFileActions({ investigation, intake });

  return (
    <div className={`sources${drop.dragging ? ' intake-dropping' : ''}`} {...drop.props}>
      <Strip investigation={investigation} intake={intake} totals={totals} />
      <div className="sources__body">
        <section className="view-panel intake-card">
          <header className="intake-card__head">
            <div className="intake-card__title">
              <Database color={paletteVar('vermilion-4')} />
              <H4>Sources</H4>
              <span className={Classes.TEXT_MUTED}>
                {formatCount(intake.files.length)} {intake.files.length === 1 ? 'file' : 'files'} · {formatCount(totals.total)} passages
              </span>
            </div>
          </header>
          {intake.error && (
            <Callout intent={Intent.DANGER} className="intake-card__problem">
              {intake.error.message}
            </Callout>
          )}
          <div className="intake-card__scroll">
            {intake.loading ? (
              <SkeletonRows />
            ) : !files.length && !intake.pending.length ? (
              <NonIdealState icon={<Import size={48} />} title="No files yet" description="Drop files here or use Import files." action={<ImportButton onFiles={intake.importFiles} primary={false} />} />
            ) : (
              <HTMLTable compact interactive className="intake-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th className="intake-table__register">Register</th>
                    <th className="intake-num">Passages</th>
                    <th className="intake-table__status">Status</th>
                    <th className="intake-table__menu" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {[...intake.pending, ...files].map((f) => (
                    <SourceRow key={f.id} file={f} intake={intake} investigation={investigation} actions={actions} />
                  ))}
                </tbody>
              </HTMLTable>
            )}
          </div>
        </section>
        <ModelLog intake={intake} />
      </div>
      {actions.alerts}
    </div>
  );
}

function SourceRow({ file, intake, investigation, actions }: { file: IntakeFile; intake: Intake; investigation: string; actions: ReturnType<typeof useFileActions> }) {
  const { dc } = useDataClient();
  const pending = file.status === 'importing';
  const open = () => navigate(fileHref(investigation, file.id));
  const menu = <FileMenu file={file} onRunAgain={intake.runAgain} originalUrl={dc && !pending ? fileUrl(dc, file.id) : null} onOpen={open} openLabel="Open in Files" {...actions.menuProps(file)} />;
  const cells = (
    <>
      <td>
        <span className="intake-name">
          <FormatIcon format={file.format} documentId={file.id} />
          {actions.nameCell(file)}
        </span>
      </td>
      <td>
        <span className="intake-name">{actions.registerCell(file)}</span>
      </td>
      <td className="intake-num">{file.passages ?? ''}</td>
      <td>
        <StatusCell file={file} onRunAgain={intake.runAgain} />
      </td>
      <td className="intake-table__menu">{!pending && <RowMenu menu={menu} label={file.name} />}</td>
    </>
  );
  return pending ? <tr>{cells}</tr> : <MenuRow menu={menu} onOpen={open}>{cells}</MenuRow>;
}

interface Totals {
  /** Passages in every file with text. */
  total: number;
  /** Passages the model has been through. */
  read: number;
  /** Passages still to read, in files waiting or being read. */
  left: number;
  /** Files waiting or not yet read. */
  waiting: number;
}

function sumUp(files: IntakeFile[]): Totals {
  let total = 0;
  let read = 0;
  let left = 0;
  let waiting = 0;
  for (const f of files) {
    const m = f.passages ?? 0;
    if (f.status === 'notext') continue;
    total += m;
    if (f.status === 'done' || f.status === 'gaps' || f.status === 'failed') read += m;
    else {
      read += f.read;
      if (f.status === 'waiting' || f.status === 'reading' || f.status === 'unread') {
        left += Math.max(0, m - f.read);
        waiting += f.status === 'reading' ? 0 : 1;
      }
    }
  }
  return { total, read, left, waiting };
}

/** Re-render every second while `on`, for the live clock. */
function useSecondTick(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

/** The file the model just finished, what it pulled out of it, and the way in (owner, 8A). It holds until the next
 * file starts reading. */
function DoneLine({ investigation, file }: { investigation: string; file: IntakeFile }) {
  const view = useDocumentView(file.id).data;
  const things = new Set<string>();
  const links = new Set<string>();
  for (const p of view?.passages ?? []) {
    for (const m of p.mentions) things.add(`${m.type}:${m.canonicalId || m.pk}`);
    for (const r of p.relationships) links.add(r.pk);
  }
  for (const r of view?.records ?? []) for (const m of r.mentions) things.add(`${m.type}:${m.canonicalId || m.pk}`);
  const found = !view
    ? null
    : !things.size && !links.size
      ? 'nothing found'
      : [things.size === 1 ? '1 person, place or thing' : `${things.size} people, places and things`, links.size === 1 ? '1 link' : `${links.size} links`].join(', ');
  const href = fileHref(investigation, file.id);
  return (
    <div className="sources__line">
      <SmallTick color="var(--bp-palette-green-5)" /> Done: <strong>{file.name}</strong>
      {found && <span className="sources__clock"> · {found} ·</span>}
      <a href={href} onClick={(e) => (e.preventDefault(), navigate(href))}>
        Open it
      </a>
    </div>
  );
}

/** The strip: what the model is doing right now, readable from the back of the room. It never hides. */
function Strip({ investigation, intake, totals }: { investigation: string; intake: Intake; totals: Totals }) {
  const now = useSecondTick(intake.model === 'reading');
  const reading = intake.files.filter((f) => f.status === 'reading' || (intake.health?.extracting ?? []).includes(f.id));
  const stateTag =
    intake.model === 'reading' ? (
      <Tag intent={Intent.PRIMARY} minimal size="large">
        Reading
      </Tag>
    ) : intake.model === 'off' ? (
      <Tag intent={Intent.WARNING} minimal size="large">
        Off
      </Tag>
    ) : (
      <Tag minimal size="large">
        Idle
      </Tag>
    );

  let line;
  if (intake.model === 'off') {
    line = (
      <div className="sources__line sources__line--off">
        <WarningSign color="var(--bp-palette-orange-5)" />
        {MODEL_OFF}
      </div>
    );
  } else if (intake.model === 'reading') {
    const elapsed = intake.callStartedAt ? clock((now - intake.callStartedAt) / 1000) : null;
    const usually = intake.pace ? `, usually about ${clock(intake.pace)}` : '';
    const one = reading.length === 1 ? reading[0] : null;
    line = (
      <div className="sources__line">
        Reading{' '}
        {one ? (
          <>
            <strong>{one.name}</strong>, passage {Math.min(one.read + 1, one.passages ?? one.read + 1)} of {one.passages ?? '?'}
          </>
        ) : (
          <strong>{reading.length} files</strong>
        )}
        {elapsed && (
          <span className="sources__clock">
            {' '}
            · {elapsed}
            {usually}
          </span>
        )}
      </div>
    );
  } else if (intake.lastDone) {
    line = <DoneLine key={intake.lastDone.id} investigation={investigation} file={intake.lastDone} />;
  } else {
    const n = totals.waiting;
    line = (
      <div className="sources__line">
        {!intake.files.length ? 'Idle.' : n ? `Idle. ${n} ${n === 1 ? 'file waits' : 'files wait'} to be read.` : 'Idle. Everything here has been read.'}
      </div>
    );
  }

  // The bar only when there is reading to show: the model on and passages still to go.
  const leftSeconds = intake.pace && totals.left ? totals.left * intake.pace : null;
  const showProgress = intake.model !== 'off' && totals.left > 0;
  return (
    <div className="sources__strip" aria-live="polite">
      <div className="sources__model">
        <span className="caps-heading">Model</span>
        <span>{intake.modelName ?? 'Local model'}</span>
        {stateTag}
      </div>
      <div className="sources__now">
        {line}
        {showProgress && (
          <div className="sources__progress">
            <ProgressBar intent={Intent.PRIMARY} animate={false} stripes={false} value={totals.read / totals.total} />
            <span>
              {formatCount(totals.read)} of {formatCount(totals.total)} passages read
            </span>
            {leftSeconds != null && <span>{aboutLeft(leftSeconds)}</span>}
          </div>
        )}
      </div>
      <ImportButton onFiles={intake.importFiles} />
    </div>
  );
}

function ModelLog({ intake }: { intake: Intake }) {
  const names = new Map(intake.files.map((f) => [f.id, f.name]));
  return (
    <section className="view-panel intake-card sources__log">
      <header className="intake-card__head">
        <div className="intake-card__title">
          <h6 className="caps-heading">Model log</h6>
          <span className={Classes.TEXT_MUTED}>
            {formatCount(intake.log.length)} {intake.log.length === 1 ? 'call' : 'calls'}
          </span>
        </div>
      </header>
      <div className="intake-card__scroll">
        {intake.logLoading ? (
          <SkeletonRows />
        ) : !intake.log.length ? (
          <p className={`${Classes.TEXT_MUTED} intake-card__empty`}>No model calls yet.</p>
        ) : (
          <HTMLTable compact className="intake-table log-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>File · passage</th>
                <th>Call</th>
                <th className="intake-num">Seconds</th>
                <th className="intake-num">Tokens</th>
                <th aria-label="Result" />
              </tr>
            </thead>
            <tbody>
              {intake.log.map((r) => (
                <LogRow key={r.id} row={r} file={names.get(r.documentId ?? '') ?? names.get(docOfPassage(r.passageId)) ?? ''} />
              ))}
            </tbody>
          </HTMLTable>
        )}
      </div>
    </section>
  );
}

function docOfPassage(passageId: string | null): string {
  const cut = passageId?.lastIndexOf('-p') ?? -1;
  return passageId && cut > 0 ? passageId.slice(0, cut) : '';
}

function LogRow({ row, file }: { row: InferenceRow; file: string }) {
  const n = passageNumber(row.passageId);
  const at = new Date(row.at);
  const time = Number.isNaN(at.getTime()) ? '' : at.toLocaleTimeString('en-GB', { hour12: false });
  const label = n != null ? `${file} · ${n}` : file;
  return (
    <tr className={row.ok ? undefined : 'log-table__failed'}>
      <td className="intake-num">{time}</td>
      <td className="log-table__file">
        <FitName name={label} />
      </td>
      <td>{callLabel(row.purpose)}</td>
      <td className="intake-num">{(row.latencyMs / 1000).toFixed(1)}</td>
      <td className="intake-num">{row.ok ? `${row.promptTokens ?? '?'} to ${row.outputTokens ?? '?'}` : 'failed'}</td>
      <td>{row.ok ? <SmallTick color="var(--bp-palette-green-5)" /> : <ErrorIcon color="var(--bp-palette-red-5)" />}</td>
    </tr>
  );
}
