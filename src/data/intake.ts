// Intake: the calls the Files and Data Sources views make. Import a file, read it again, follow the model log and
// the engine's health. Plain functions over the engine's own routes; the hooks in hooks.tsx poll these. Every one
// takes the connection first so the proofs run them under Node over HTTP.
import { engineGet, enginePost, type DataClient } from './client.ts';
import type {
  CreateFolderRequest,
  CreateInvestigationRequest,
  CreateSavedRequest,
  DeleteInvestigationResult,
  DepictsLink,
  DeleteResult,
  DocumentView,
  ExtractAllResult,
  ExtractResult,
  Folder,
  FoldersResult,
  Health,
  ImportRequest,
  ImportResult,
  InferenceRow,
  Investigation,
  InvestigationsResult,
  MoveDocumentToRequest,
  MoveDocumentToResult,
  RenameDocumentResult,
  RenameRegisterResult,
  SavedItem,
  SavedKind,
  SavedList,
  SetRegisterResult,
  UnlinkImageResult,
  UpdateSavedRequest,
} from './types.ts';

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

/** Run the model over one imported document again. Fails with status 503 while the model is off, 400 on a no-text file. */
export function extractAgain(dc: DataClient, documentId: string): Promise<ExtractResult> {
  return enginePost<ExtractResult>(dc, '/barghest/extract', { documentId });
}

/** The file view in one call: the document, its passages with what the model pulled, its rows, its model log. */
export function getDocumentView(dc: DataClient, documentId: string): Promise<DocumentView> {
  return engineGet<DocumentView>(dc, '/barghest/document', { documentId });
}

/** The investigation's folders as a flat list with counts, plus the files at its top level. */
export function getFolders(dc: DataClient, investigation: string): Promise<FoldersResult> {
  return engineGet<FoldersResult>(dc, '/barghest/folders', { investigation });
}

export function createFolder(dc: DataClient, req: CreateFolderRequest): Promise<Folder> {
  return enginePost<Folder>(dc, '/barghest/folders', {}, { ...req });
}

export function renameFolder(dc: DataClient, folderId: string, name: string): Promise<Folder> {
  return enginePost<Folder>(dc, '/barghest/rename-folder', {}, { folderId, name });
}

/** Move a folder under another (empty `parentId` is the top level). Refused into itself or its own subfolders. */
export function moveFolder(dc: DataClient, folderId: string, parentId: string): Promise<Folder> {
  return enginePost<Folder>(dc, '/barghest/move-folder', {}, { folderId, parentId });
}

/** Delete an empty folder. Fails with 409 ("Move or delete what's inside first.") when it holds anything. */
export function deleteFolder(dc: DataClient, folderId: string): Promise<{ folderId: string; deleted: true }> {
  return enginePost<{ folderId: string; deleted: true }>(dc, '/barghest/delete-folder', {}, { folderId });
}

/** Move a file to a folder of its investigation (empty `folderId` is the top level). */
export function moveDocument(dc: DataClient, documentId: string, folderId: string): Promise<{ documentId: string; folderId: string }> {
  return enginePost<{ documentId: string; folderId: string }>(dc, '/barghest/move-document', {}, { documentId, folderId });
}

/** Rename an investigation. The id and the address bar keep the first name. */
export function renameInvestigation(dc: DataClient, investigation: string, name: string): Promise<Investigation> {
  return enginePost<Investigation>(dc, '/barghest/rename-investigation', {}, { investigation, name });
}

/** Change what an investigation looks for. The next extraction uses the new blocks; files already read keep what they had. */
export function editInvestigation(dc: DataClient, investigation: string, blocks: string[]): Promise<Investigation> {
  return enginePost<Investigation>(dc, '/barghest/edit-investigation', {}, { investigation, blocks });
}

/** Run the model again on every file of the investigation. Fails with 503 while the model is off. */
export function extractAll(dc: DataClient, investigation: string): Promise<ExtractAllResult> {
  return enginePost<ExtractAllResult>(dc, '/barghest/extract-all', { investigation });
}

/** Delete an investigation with every file, folder and object in it. Fails with 409 while a file of it is being read. */
export function deleteInvestigation(dc: DataClient, investigation: string): Promise<DeleteInvestigationResult> {
  return enginePost<DeleteInvestigationResult>(dc, '/barghest/delete-investigation', {}, { investigation });
}

/** Rename a file's shown name. The extension is kept; the title it came in with never changes. */
export function renameDocument(dc: DataClient, documentId: string, name: string): Promise<RenameDocumentResult> {
  return enginePost<RenameDocumentResult>(dc, '/barghest/rename-document', {}, { documentId, name });
}

/** Change a file's shown register (free text, empty for none). The system it came from never changes. */
export function setRegister(dc: DataClient, documentId: string, register: string): Promise<SetRegisterResult> {
  return enginePost<SetRegisterResult>(dc, '/barghest/set-register', {}, { documentId, register });
}

/** Rename a register on every file of the investigation that carries it. */
export function renameRegister(dc: DataClient, investigation: string, from: string, to: string): Promise<RenameRegisterResult> {
  return enginePost<RenameRegisterResult>(dc, '/barghest/rename-register', {}, { investigation, from, to });
}

/** Move a file to another investigation: removed here, imported there from its stored copy, read again by the model. */
export function moveDocumentToInvestigation(dc: DataClient, req: MoveDocumentToRequest): Promise<MoveDocumentToResult> {
  return enginePost<MoveDocumentToResult>(dc, '/barghest/move-document-to', {}, { ...req });
}

/** Delete a file and everything the model pulled from it. Fails with 409 while the model is reading the file. */
export function deleteDocument(dc: DataClient, documentId: string): Promise<DeleteResult> {
  return enginePost<DeleteResult>(dc, '/barghest/delete-document', { documentId });
}

/** The URL of the stored original, for an "Open original" link in a new tab; a PDF renders in the browser. */
export function fileUrl(dc: DataClient, documentId: string): string {
  return `${dc.baseUrl}/barghest/file?documentId=${encodeURIComponent(documentId)}`;
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

/** The investigation's saved items of one kind, or of every kind when `kind` is left out. Newest change first, no bodies. */
export function listSaved(dc: DataClient, investigation: string, kind?: SavedKind): Promise<SavedList> {
  return engineGet<SavedList>(dc, '/barghest/saved', kind ? { investigation, kind } : { investigation });
}

/** One saved item with its body. Fails with 404 when it is gone. */
export function getSaved(dc: DataClient, id: string): Promise<SavedItem> {
  return engineGet<SavedItem>(dc, '/barghest/saved-item', { id });
}

/** Make a saved item in a folder (or the top level). Its id comes back fixed for life; the shell puts it in `?saved=`. */
export function createSaved(dc: DataClient, req: CreateSavedRequest): Promise<SavedItem> {
  return enginePost<SavedItem>(dc, '/barghest/saved', {}, { ...req });
}

/** Rename, save the body or move a saved item, any mix in one call. Returns the item with its body. */
export function updateSaved(dc: DataClient, id: string, changes: UpdateSavedRequest): Promise<SavedItem> {
  return enginePost<SavedItem>(dc, '/barghest/update-saved', {}, { id, ...changes });
}

export function deleteSaved(dc: DataClient, id: string): Promise<{ id: string; deleted: true }> {
  return enginePost<{ id: string; deleted: true }>(dc, '/barghest/delete-saved', {}, { id });
}

/** "This photo shows this object": a `depicts` link from the photo to `objectId` (`Type:pk`). The first photo linked becomes the object's picture. */
export function linkImage(dc: DataClient, documentId: string, objectId: string): Promise<DepictsLink> {
  return enginePost<DepictsLink>(dc, '/barghest/link-image', {}, { documentId, objectId });
}

/** Remove the link. If the photo was the object's picture, another linked photo takes over or the picture clears. */
export function unlinkImage(dc: DataClient, documentId: string, objectId: string): Promise<UnlinkImageResult> {
  return enginePost<UnlinkImageResult>(dc, '/barghest/unlink-image', {}, { documentId, objectId });
}

/** The object's picture, the one its graph node shows; `null` clears it. A photo not yet linked is linked first. */
export function setPhoto(dc: DataClient, objectId: string, documentId: string | null): Promise<{ objectId: string; photoId: string }> {
  return enginePost<{ objectId: string; photoId: string }>(dc, '/barghest/set-photo', {}, { objectId, documentId });
}
