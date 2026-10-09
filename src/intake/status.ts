// What Files and Data Sources say about each file, worked out from three reads: the Document rows, the engine's
// health (which files the model is reading now) and the model log. Plain functions, so both views say the same thing.
import type { Health, InferenceRow, Row } from '../data/index.ts';

export type FileStatus = 'importing' | 'waiting' | 'unread' | 'reading' | 'done' | 'gaps' | 'failed' | 'notext';

export interface IntakeFile {
  id: string;
  name: string;
  register: string;
  format: string;
  importedAt: string | null;
  status: FileStatus;
  /** Passages in the file (M), or null while unknown. */
  passages: number | null;
  /** Passages the model has been through (N). */
  read: number;
  /** Passages whose calls failed, by number (1-based). */
  failedPassages: number[];
}

/** An import still on its way to the engine: shown as a row at once, before the engine knows the file. */
export interface PendingImport {
  key: string;
  name: string;
}

export const NO_REGISTER = 'No register';

/** The engine's words for each file kind it reads, for the refusal message. */
export function refusalFor(fileName: string): string {
  const ext = extensionOf(fileName);
  const kind = ext === 'doc' || ext === 'docx' ? 'Word files' : ext === 'xls' || ext === 'xlsx' ? 'Excel files' : ext ? `.${ext} files` : 'Files without an extension';
  return `${fileName}: ${kind} can't be read yet. BARGHEST reads PDFs with text, CSV, TXT, JSON and MD.`;
}

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

export function accepts(health: Health | null, fileName: string): boolean {
  const formats = health?.formats?.length ? health.formats : ['pdf', 'csv', 'txt', 'json', 'md'];
  return formats.includes(extensionOf(fileName));
}

const EXTRACT = /^extract/;

/** The 1-based passage number in a passage id (`<documentId>-p<index>`, index from 0). */
export function passageNumber(passageId: string | null): number | null {
  const m = passageId ? /-p(\d+)$/.exec(passageId) : null;
  return m ? Number(m[1]) + 1 : null;
}

/** The document a log row belongs to: its own `documentId`, or the one its passage id starts with. */
export function documentOf(row: InferenceRow, ids: ReadonlySet<string>): string | null {
  if (row.documentId && ids.has(row.documentId)) return row.documentId;
  if (row.passageId) {
    const cut = row.passageId.lastIndexOf('-p');
    const doc = cut > 0 ? row.passageId.slice(0, cut) : null;
    if (doc && ids.has(doc)) return doc;
  }
  return null;
}

/**
 * Each file with its status and progress. `runFrom` holds, per file, the log id at which "Run again" was pressed, so
 * a re-run counts its passages from zero.
 */
export function intakeFiles(
  rows: Row[],
  passages: Record<string, number>,
  log: InferenceRow[],
  health: Health | null,
  runFrom: Record<string, number>,
): IntakeFile[] {
  const reading = new Set(health?.extracting ?? []);
  const modelOn = !!health?.ollama;
  const seen = new Map<string, Set<string>>();
  const failed = new Map<string, Set<number>>();
  for (const r of log) {
    if (!EXTRACT.test(r.purpose) || !r.documentId || !r.passageId) continue;
    if (r.id <= (runFrom[r.documentId] ?? 0)) continue;
    if (!seen.has(r.documentId)) seen.set(r.documentId, new Set());
    seen.get(r.documentId)!.add(r.passageId);
    const n = passageNumber(r.passageId);
    if (!r.ok && n != null) {
      if (!failed.has(r.documentId)) failed.set(r.documentId, new Set());
      failed.get(r.documentId)!.add(n);
    } else if (r.ok && n != null) failed.get(r.documentId)?.delete(n);
  }
  return rows.map((row) => {
    const p = row.properties;
    const id = row.pk;
    const total = passages[id] ?? null;
    const read = Math.min(seen.get(id)?.size ?? 0, total ?? Infinity);
    const docStatus = String(p.status ?? '');
    let status: FileStatus;
    if (docStatus === 'no text') status = 'notext';
    else if (reading.has(id)) status = read > 0 ? 'reading' : 'waiting';
    else if (docStatus === 'extracted') status = 'done';
    else if (docStatus === 'extracted with gaps') status = 'gaps';
    else if (docStatus === 'extraction failed') status = 'failed';
    else status = modelOn ? 'waiting' : 'unread';
    return {
      id,
      name: String(p.name ?? row.title ?? id),
      register: String(p.register ?? p.system ?? '') || NO_REGISTER,
      format: String(p.format ?? ''),
      importedAt: p.importedAt ? String(p.importedAt) : null,
      status,
      passages: total,
      read,
      failedPassages: [...(failed.get(id) ?? [])].sort((a, b) => a - b),
    };
  });
}

/** Sorted by register, so a register's files sit together, then by name; "No register" last. */
export function byRegister(a: IntakeFile, b: IntakeFile): number {
  if (a.register !== b.register) {
    if (a.register === NO_REGISTER) return 1;
    if (b.register === NO_REGISTER) return -1;
    return a.register.localeCompare(b.register);
  }
  return a.name.localeCompare(b.name);
}

/** Mean seconds per passage over the last 20 good extract calls, or null before the first one. */
export function secondsPerPassage(log: InferenceRow[]): number | null {
  const calls = log.filter((r) => EXTRACT.test(r.purpose) && r.ok).slice(-20);
  if (!calls.length) return null;
  return calls.reduce((s, r) => s + r.latencyMs, 0) / calls.length / 1000;
}

/** "About 13 minutes left", always "About", never a promise. */
export function aboutLeft(seconds: number): string {
  if (seconds < 90) return 'About a minute left';
  return `About ${Math.round(seconds / 60)} minutes left`;
}

/** 0:23, 1:05, 12:40. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** What the log calls each kind of model call. */
export function callLabel(purpose: string): string {
  if (purpose === 'extract') return 'Extract';
  if (purpose === 'extract-retry') return 'Extract again';
  if (purpose === 'decide') return 'Decide';
  if (purpose === 'ask') return 'Answer';
  if (purpose.startsWith('embed')) return 'Embed';
  return purpose.charAt(0).toUpperCase() + purpose.slice(1);
}

/** Imported at, as the time of day when today, else the date. */
export function importedLabel(at: string | null): string {
  if (!at) return '';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
