// What an investigation can do from the Files tree, by its "…" or a right-click: Open, New folder, Rename where it
// stands, Run the model again on every file, Delete. The last two ask first; Delete says what goes with it (the
// handoff's words). Deleting the open investigation opens the next one the engine lists.
import { Alert, Intent, Menu, MenuDivider, MenuItem } from '@blueprintjs/core';
import { Refresh, Trash } from '@blueprintjs/icons';
import { useState } from 'react';
import { deleteInvestigation, EngineError, extractAll, renameInvestigation, useDataClient, type Investigation } from '../data/index.ts';
import { toast } from '../intake/toaster';
import { MODEL_OFF, type Intake } from '../intake/useIntake';
import { useInvestigationList } from '../shell/investigations';
import { folderHref, navigate } from '../shell/route';

const fail = (e: Error) => toast(e instanceof EngineError ? e.message : 'The engine did not answer.', e instanceof EngineError && e.status === 409 ? Intent.WARNING : Intent.DANGER);
const filesWord = (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`;

export function useInvestigationActions({ current, intake, newFolder }: { current: string; intake: Intake; newFolder: (parentId: string) => void }) {
  const { dc } = useDataClient();
  const list = useInvestigationList();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Investigation | null>(null);
  const [rereading, setRereading] = useState<Investigation | null>(null);
  const filesOf = (inv: Investigation) => (inv.id === current ? intake.files.length : inv.documents);

  const rename = (inv: Investigation, name: string) => dc && renameInvestigation(dc, inv.id, name).then(list.reload, fail);
  const remove = () => {
    const inv = deleting;
    setDeleting(null);
    if (!dc || !inv) return;
    deleteInvestigation(dc, inv.id).then(() => {
      list.reload();
      if (inv.id !== current) return;
      const next = list.data?.investigations.find((i) => i.id !== inv.id);
      navigate(next ? folderHref(next.id) : '/');
    }, fail);
  };
  const reread = () => {
    const inv = rereading;
    setRereading(null);
    if (!dc || !inv) return;
    extractAll(dc, inv.id).then(intake.refresh, (e: Error) => (e instanceof EngineError && e.status === 503 ? toast(MODEL_OFF, Intent.WARNING) : fail(e)));
  };

  const menu = (inv: Investigation) => (
    <Menu className="intake-menu">
      <MenuItem text="Open" onClick={() => navigate(folderHref(inv.id))} />
      {inv.id === current && <MenuItem text="New folder…" onClick={() => newFolder('')} />}
      <MenuItem text="Rename" onClick={() => setRenaming(inv.id)} />
      <MenuItem text="Run the model again on every file…" disabled={!filesOf(inv)} onClick={() => (intake.model === 'off' ? toast(MODEL_OFF, Intent.WARNING) : setRereading(inv))} />
      <MenuDivider />
      <MenuItem text="Delete…" intent={Intent.DANGER} onClick={() => setDeleting(inv)} />
    </Menu>
  );

  // How long a full read takes, when the open investigation's pace is known.
  const passages = intake.files.reduce((n, f) => n + (f.passages ?? 0), 0);
  const minutes = rereading?.id === current && intake.pace && passages ? Math.max(1, Math.round((passages * intake.pace) / 60)) : null;
  const n = deleting ? filesOf(deleting) : 0;

  const alerts = (
    <>
      <Alert isOpen={!!deleting} className="intake-alert" intent={Intent.DANGER} icon={<Trash />} cancelButtonText="Cancel" confirmButtonText="Delete" onCancel={() => setDeleting(null)} onConfirm={remove}>
        {deleting && `Delete ${deleting.name}? ${n ? `Its ${filesWord(n)}, its folders and everything the model pulled from them go too.` : 'Its folders go too.'}`}
      </Alert>
      <Alert isOpen={!!rereading} className="intake-alert" intent={Intent.PRIMARY} icon={<Refresh />} cancelButtonText="Cancel" confirmButtonText="Run again" onCancel={() => setRereading(null)} onConfirm={reread}>
        {rereading && `Run the model again on all ${filesWord(filesOf(rereading))} in ${rereading.name}?${minutes ? ` About ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.` : ''}`}
      </Alert>
    </>
  );

  return { menu, alerts, isRenaming: (inv: Investigation) => renaming === inv.id, stopRenaming: () => setRenaming(null), rename };
}
