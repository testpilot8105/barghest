// Everything Files and Data Sources show about an investigation's intake, in one hook: its files with status and
// progress, the model's state, the investigation's part of the model log, and the two actions (import, run again).
// It reads only through src/data: the Document rows, a passage count per file, health and the model log, polled.
import { Intent } from '@blueprintjs/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  countRows,
  EngineError,
  extractAgain,
  fetchRows,
  histogram,
  importFile,
  startExploration,
  useAsync,
  useDataClient,
  useHealth,
  useInferenceLog,
  withStep,
  type DataClient,
  type Health,
  type InferenceRow,
} from '../data/index.ts';
import { accepts, documentOf, intakeFiles, refusalFor, secondsPerPassage, type IntakeFile, type PendingImport } from './status.ts';
import { toast } from './toaster.ts';

const POLL_MS = 2000;
const MODEL_OFF = 'The local model is off, so files are stored but not read yet.';
const NO_TEXT = "No text in this PDF. It may be a scan, and BARGHEST doesn't read scans yet.";

export type ModelState = 'off' | 'idle' | 'reading';

export interface Intake {
  loading: boolean;
  error: Error | null;
  health: Health | null;
  model: ModelState;
  modelName: string | null;
  /** Imports still on their way to the engine, shown above the list as "Importing…". */
  pending: IntakeFile[];
  /** The investigation's files, unsorted; each view sorts its own way. */
  files: IntakeFile[];
  /** This investigation's model calls, newest first. */
  log: InferenceRow[];
  logLoading: boolean;
  /** Seconds per passage over recent calls, or null before the first one. */
  pace: number | null;
  /** When the call in flight started (ms), for the live clock; null when nothing is being read. */
  callStartedAt: number | null;
  /** The last file the model finished while this screen was open, held until the next one starts. */
  lastDone: IntakeFile | null;
  importFiles: (files: File[], folderId?: string) => void;
  runAgain: (file: IntakeFile) => void;
  /** Read the files again, after a delete, a move or a rename. */
  refresh: () => void;
}

async function fileRows(dc: DataClient, investigation: string) {
  const exp = withStep(startExploration('Document', 500), { filter: { property: 'scenario', op: 'eq', value: investigation } });
  return (await fetchRows(dc, exp)).rows;
}

/** Passages per file: one histogram, then a count each for any file past its 20 buckets. */
async function passageCounts(dc: DataClient, ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const of = (filter: { property: string; op: 'in' | 'eq'; value: unknown }) => withStep(startExploration('Passage'), { filter });
  const h = await histogram(dc, of({ property: 'documentId', op: 'in', value: ids }), 'documentId');
  const out: Record<string, number> = {};
  for (const b of h.buckets) out[b.bucket] = b.count;
  const missing = ids.filter((id) => !(id in out));
  if (h.other > 0) {
    await Promise.all(missing.map(async (id) => (out[id] = await countRows(dc, of({ property: 'documentId', op: 'eq', value: id })))));
  } else for (const id of missing) out[id] = 0;
  return out;
}

export function useIntake(investigation: string): Intake {
  const { dc } = useDataClient();
  const health = useHealth(POLL_MS);
  const allLog = useInferenceLog(POLL_MS);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const rows = useAsync((c) => fileRows(c, investigation), `${investigation}:${tick}`);
  const ids = useMemo(() => (rows.data ?? []).map((r) => r.pk).sort(), [rows.data]);
  const counts = useAsync((c) => passageCounts(c, ids), ids.join('|'));
  const [pending, setPending] = useState<PendingImport[]>([]);
  const [runFrom, setRunFrom] = useState<Record<string, number>>({});

  const idSet = useMemo(() => new Set(ids), [ids]);
  const log = useMemo(() => (allLog.data ?? []).filter((r) => documentOf(r, idSet)), [allLog.data, idSet]);

  // Status lives on the Document rows: read them again whenever the engine starts or stops a file, or logs a call
  // for this investigation.
  const extractingKey = (health.data?.extracting ?? []).join('|');
  const lastLogId = log.length ? log[log.length - 1].id : 0;
  useEffect(() => {
    refresh();
  }, [extractingKey, lastLogId, refresh]);

  const files = useMemo(
    () => intakeFiles(rows.data ?? [], counts.data ?? {}, allLog.data ?? [], health.data, runFrom),
    [rows.data, counts.data, allLog.data, health.data, runFrom],
  );

  // The live clock starts when the last call ended, or when reading began if no call has ended since.
  const model: ModelState = !health.data?.ollama ? 'off' : extractingKey ? 'reading' : 'idle';
  const readingSince = useRef<number | null>(null);
  if (model === 'reading' && readingSince.current == null) readingSince.current = Date.now();
  if (model !== 'reading') readingSince.current = null;
  const newest = allLog.data?.length ? Date.parse(allLog.data[allLog.data.length - 1].at) : NaN;
  const callStartedAt = model === 'reading' ? Math.max(readingSince.current ?? 0, Number.isNaN(newest) ? 0 : newest) : null;

  // The Done line: a file that leaves the reading list and turns up finished once its row is read again, held until
  // the next file starts.
  const [lastDone, setLastDone] = useState<IntakeFile | null>(null);
  const prevReading = useRef<string[]>([]);
  const justLeft = useRef<string[]>([]);
  useEffect(() => {
    const now = health.data?.extracting ?? [];
    justLeft.current.push(...prevReading.current.filter((id) => !now.includes(id)));
    prevReading.current = now;
    if (now.length) {
      setLastDone(null);
      justLeft.current = [];
      return;
    }
    for (const id of [...justLeft.current].reverse()) {
      const f = files.find((x) => x.id === id);
      if (f?.status === 'done' || f?.status === 'gaps') {
        setLastDone(f);
        justLeft.current = [];
        return;
      }
    }
  }, [extractingKey, files, health.data]);

  const importFiles = useCallback(
    (list: File[], folderId?: string) => {
      if (!dc) return;
      for (const file of list) {
        if (!accepts(health.data, file.name)) {
          toast(refusalFor(file.name));
          continue;
        }
        const key = `${file.name}:${file.size}:${file.lastModified}:${Math.random()}`;
        setPending((p) => [...p, { key, name: file.name }]);
        importFile(dc, { file, investigation, folderId })
          .then((r) => {
            if (r.status === 'no text') toast(`${file.name}: ${NO_TEXT}`, Intent.WARNING);
          })
          .catch((e: Error) => toast(`${file.name}: ${e instanceof EngineError ? e.message : 'the engine did not answer.'}`))
          .finally(() => {
            setPending((p) => p.filter((x) => x.key !== key));
            refresh();
          });
      }
    },
    [dc, health.data, investigation, refresh],
  );

  const runAgain = useCallback(
    (file: IntakeFile) => {
      if (!dc) return;
      const from = allLog.data?.length ? allLog.data[allLog.data.length - 1].id : 0;
      setRunFrom((r) => ({ ...r, [file.id]: from }));
      extractAgain(dc, file.id)
        .catch((e: Error) => toast(e instanceof EngineError && e.status === 503 ? MODEL_OFF : `${file.name}: ${e.message}`))
        .finally(refresh);
    },
    [dc, allLog.data, refresh],
  );

  return {
    loading: rows.loading && !rows.data,
    error: rows.error,
    health: health.data,
    model,
    modelName: health.data && !Array.isArray(health.data.models) ? health.data.models.chat : null,
    pending: pending.map((p) => ({ id: p.key, name: p.name, register: '', format: '', importedAt: null, status: 'importing', passages: null, read: 0, failedPassages: [] })),
    files,
    log: [...log].reverse(),
    logLoading: allLog.loading && !allLog.data,
    pace: secondsPerPassage(log.length ? log : (allLog.data ?? [])),
    callStartedAt,
    lastDone,
    importFiles,
    runAgain,
    refresh,
  };
}

export { MODEL_OFF, NO_TEXT };
