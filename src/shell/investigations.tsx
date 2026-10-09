// The investigations, read once for the whole shell: the menu bar's Investigation menu, Files' list on the left and
// every screen's name for the open one come from here. Screens show the name, never the id. New investigation is one
// dialog, opened from the menu or from Files: a name, nothing else. A new investigation looks for people,
// organisations, places, events and anything else the model finds (the engine's general set); no templates, no
// checklist, no list to fill in (owner, 09.10.2026: "make it make sense").
import { Button, Callout, Dialog, DialogBody, DialogFooter, FormGroup, InputGroup, Intent } from '@blueprintjs/core';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { createInvestigation, EngineError, useDataClient, useInvestigations, type Investigation, type InvestigationsResult } from '../data/index.ts';
import { navigate, viewHref } from './route';

interface InvestigationsContextValue {
  data: InvestigationsResult | null;
  loading: boolean;
  error: Error | null;
  find: (id: string | null) => Investigation | null;
  openNew: () => void;
}

const InvestigationsContext = createContext<InvestigationsContextValue>({
  data: null,
  loading: true,
  error: null,
  find: () => null,
  openNew: () => {},
});

export function useInvestigationList(): InvestigationsContextValue {
  return useContext(InvestigationsContext);
}

export function InvestigationsProvider({ children }: { children: ReactNode }) {
  const list = useInvestigations();
  const [creating, setCreating] = useState(false);
  const value = useMemo<InvestigationsContextValue>(
    () => ({
      data: list.data,
      loading: list.loading,
      error: list.error,
      find: (id) => list.data?.investigations.find((i) => i.id === id) ?? null,
      openNew: () => setCreating(true),
    }),
    [list.data, list.loading, list.error],
  );
  return (
    <InvestigationsContext.Provider value={value}>
      {children}
      {list.data && (
        <NewInvestigationDialog
          isOpen={creating}
          data={list.data}
          onClose={() => setCreating(false)}
          onCreated={(inv) => {
            setCreating(false);
            list.reload();
            navigate(viewHref(inv.id, 'files'));
          }}
        />
      )}
    </InvestigationsContext.Provider>
  );
}

/** The engine's general set: people, organisations, places, events, and anything else in the model's own words. */
const GENERAL = 'general';

function NewInvestigationDialog({ isOpen, onClose, onCreated }: { isOpen: boolean; data: InvestigationsResult; onClose: () => void; onCreated: (inv: Investigation) => void }) {
  const { dc } = useDataClient();
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setProblem(null);
    setSaving(false);
  };
  const create = () => {
    if (!name.trim()) return setProblem("A name can't be empty.");
    if (!dc) return;
    setSaving(true);
    createInvestigation(dc, { name: name.trim(), template: GENERAL })
      .then((inv) => {
        reset();
        onCreated(inv);
      })
      .catch((e: Error) => {
        setSaving(false);
        setProblem(e instanceof EngineError ? e.message : 'The engine did not answer.');
      });
  };

  return (
    <Dialog title="New investigation" isOpen={isOpen} onClose={onClose} onClosed={reset} className="new-investigation">
      <DialogBody>
        <FormGroup label="Name" labelFor="new-investigation-name">
          <InputGroup id="new-investigation-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
        </FormGroup>
        {problem && <Callout intent={Intent.DANGER}>{problem}</Callout>}
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button text="Cancel" onClick={onClose} />
            <Button intent={Intent.PRIMARY} text="Create" loading={saving} onClick={create} />
          </>
        }
      />
    </Dialog>
  );
}
