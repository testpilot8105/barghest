// Intake: the calls the Files and Data Sources views make. Import a file, read it again, follow the model log and
// the engine's health. Plain functions over the engine's own routes; the hooks in hooks.tsx poll these. Every one
// takes the connection first so the proofs run them under Node over HTTP.
import { engineGet, enginePost, type DataClient } from './client.ts';
import type { CreateInvestigationRequest, ExtractResult, Health, ImportRequest, ImportResult, InferenceRow, Investigation, InvestigationsResult } from './types.ts';

/** Store a file in an investigation; the model starts reading it unless `extract` is false or the model is off. */
export async function importFile(dc: DataClient, req: ImportRequest): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', req.file, req.file.name);
  form.set('investigation', req.investigation);
  if (req.system) form.set('system', req.system);
  if (req.folderId) form.set('folderId', req.folderId);
  if (req.extract === false) form.set('extract', 'no');
  return enginePost<ImportResult>(dc, '/barghest/import', {}, form);
}

/** Run the model over one imported document again. Fails with status 503 while the model is off. */
export function extractAgain(dc: DataClient, documentId: string): Promise<ExtractResult> {
  return enginePost<ExtractResult>(dc, '/barghest/extract', { documentId });
}

/** The model log rows with an id above `after`, oldest first. The engine returns at most 500 per call. */
export function fetchInferenceLog(dc: DataClient, after = 0): Promise<InferenceRow[]> {
  return engineGet<InferenceRow[]>(dc, '/barghest/inference-log', { after: String(after) });
}

/** The engine answers one page of the log per call; a hook that gets a full page asks again at once. */
export const INFERENCE_LOG_PAGE = 500;

/** Rows already held plus the new ones: ascending by id, no row twice, nothing older than what is held. */
export function mergeInferenceRows(held: InferenceRow[], incoming: InferenceRow[]): InferenceRow[] {
  if (!incoming.length) return held;
  const last = held.length ? held[held.length - 1].id : 0;
  const fresh = incoming.filter((r) => r.id > last).sort((a, b) => a.id - b.id);
  if (!fresh.length) return held;
  const seen = new Set<number>();
  return [...held, ...fresh].filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

export function getHealth(dc: DataClient): Promise<Health> {
  return engineGet<Health>(dc, '/barghest/health');
}

/** Every investigation with its document count, plus the templates and the block list for "What to look for". */
export function getInvestigations(dc: DataClient): Promise<InvestigationsResult> {
  return engineGet<InvestigationsResult>(dc, '/barghest/investigations');
}

/** Create an investigation. Its id comes back fixed for life; the shell puts it in the address bar. */
export function createInvestigation(dc: DataClient, req: CreateInvestigationRequest): Promise<Investigation> {
  return enginePost<Investigation>(dc, '/barghest/investigations', {}, { ...req });
}
