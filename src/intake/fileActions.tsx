// What a file can do, the same in Files and Data Sources (owner, 09.10.2026: everything is flexible): rename it, change
// its register or rename that register on every file carrying it, move it to another investigation (the model reads
// it again there, so it asks first), delete it (asks first). Names and registers change where they stand.
import { Alert, Intent, MenuItem } from '@blueprintjs/core';
import { Projects } from '@blueprintjs/icons';
import { useState } from 'react';
import { EngineError, moveDocumentToInvestigation, renameDocument, renameRegister, setRegister, useDataClient, type Investigation } from '../data/index.ts';
import { useInvestigationList } from '../shell/investigations';
import { FitName, RenameField, useDeleteFile } from './parts';
import { NO_REGISTER, type IntakeFile } from './status';
import { toast } from './toaster';
import type { Intake } from './useIntake';

type Field = 'name' | 'register' | 'registerAll';

const fail = (e: Error) => toast(e instanceof EngineError ? e.message : 'The engine did not answer.', e instanceof EngineError && e.status === 409 ? Intent.WARNING : Intent.DANGER);

export function useFileActions({ investigation, intake }: { investigation: string; intake: Intake }) {
  const { dc } = useDataClient();
  const list = useInvestigationList();
  const [editing, setEditing] = useState<{ id: string; field: Field } | null>(null);
  const [moving, setMoving] = useState<{ file: IntakeFile; to: Investigation } | null>(null);
  const changed = () => {
    intake.refresh();
    list.reload();
  };
  const del = useDeleteFile(changed);
  const stop = () => setEditing(null);
  const is = (f: IntakeFile, field: Field) => editing?.id === f.id && editing.field === field;
  const registerOf = (f: IntakeFile) => (f.register === NO_REGISTER ? '' : f.register);

  const rename = (f: IntakeFile, name: string) => dc && renameDocument(dc, f.id, name).then(intake.refresh, fail);
  const changeRegister = (f: IntakeFile, register: string) => dc && setRegister(dc, f.id, register).then(intake.refresh, fail);
  const renameEverywhere = (from: string, to: string) => dc && renameRegister(dc, investigation, from, to).then(intake.refresh, fail);
  const move = () => {
    if (!dc || !moving) return;
    const { file, to } = moving;
    setMoving(null);
    moveDocumentToInvestigation(dc, { documentId: file.id, investigation: to.id }).then(changed, fail);
  };

  const others = (list.data?.investigations ?? []).filter((i) => i.id !== investigation);
  /** The menu items FileMenu takes for one file. */
  const menuProps = (f: IntakeFile) => ({
    onRename: () => setEditing({ id: f.id, field: 'name' }),
    onChangeRegister: () => setEditing({ id: f.id, field: 'register' }),
    onRenameRegister: registerOf(f) ? () => setEditing({ id: f.id, field: 'registerAll' }) : undefined,
    moveToInvestigation: others.length ? (
      <MenuItem text="Move to another investigation">
        {others.map((i) => (
          <MenuItem key={i.id} icon={<Projects />} text={i.name} onClick={() => setMoving({ file: f, to: i })} />
        ))}
      </MenuItem>
    ) : null,
    onDelete: () => del.ask(f),
  });

  const nameCell = (f: IntakeFile) => (is(f, 'name') ? <RenameField value={f.name} onRename={(n) => rename(f, n)} onDone={stop} /> : <FitName name={f.name} />);
  const registerCell = (f: IntakeFile) =>
    is(f, 'register') ? (
      <RenameField value={registerOf(f)} placeholder={NO_REGISTER} allowEmpty onRename={(r) => changeRegister(f, r)} onDone={stop} />
    ) : is(f, 'registerAll') ? (
      <RenameField value={registerOf(f)} onRename={(r) => renameEverywhere(registerOf(f), r)} onDone={stop} />
    ) : (
      <FitName name={f.register} />
    );

  // Moving reads the file again in the other investigation, so it says how long that takes before it goes.
  const minutes = moving && intake.pace && moving.file.passages ? Math.max(1, Math.round((moving.file.passages * intake.pace) / 60)) : null;
  const moveText = !moving
    ? ''
    : intake.model === 'off'
      ? `${moving.file.name} is stored in ${moving.to.name} and read there once the model is on. Move it?`
      : `The model reads ${moving.file.name} again in ${moving.to.name}${minutes ? `, about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}` : ''}. Move it?`;

  const alerts = (
    <>
      {del.alert}
      <Alert isOpen={!!moving} className="intake-alert" intent={Intent.PRIMARY} icon={<Projects />} cancelButtonText="Cancel" confirmButtonText="Move" onCancel={() => setMoving(null)} onConfirm={move}>
        {moveText}
      </Alert>
    </>
  );

  return { menuProps, nameCell, registerCell, alerts };
}
