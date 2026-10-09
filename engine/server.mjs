// The BARGHEST engine: one Node http server on 8787. The /barghest/* routes are ours; everything else is handed to
// Palantir's @osdk/faux through msw, so @osdk/client talks to this process exactly as it would to Foundry. Every
// object lives in data/barghest.sqlite and is reloaded into faux at boot. The app reaches this through Vite's proxy,
// the proofs reach it directly. Ollama is called only from the ingest, resolve and ask modules (P5 onwards).
import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { msw } from '@osdk/faux';
import { openStore } from './store.mjs';
import { createEngine } from './faux.mjs';
import { createActionImpls } from './actions.mjs';
import { ingestFile } from './ingest/index.mjs';
import { FORMATS } from './ingest/parse.mjs';
import { resolveScenario } from './resolve/index.mjs';
import { createDecide } from './resolve/decide.mjs';
import { extractDocument } from './extract/index.mjs';
import { createLlm, MODELS } from './llm.mjs';
import { timeline, whatConnects } from './queries/graph.mjs';
import { documentView } from './queries/document.mjs';
import { ask, embedAll, searchPassages } from './ask/index.mjs';
import { createInvestigation, ensureDemoInvestigations, listInvestigations } from './investigations.mjs';
import { deleteDocument } from './documents.mjs';
import { createFolder, deleteFolder, folderFor, listFolders, moveDocument, moveFolder, renameFolder } from './folders.mjs';
import { ownership } from '../ontology/ownership.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.BARGHEST_ENGINE_PORT ?? 8787);
const DB = resolve(root, process.env.BARGHEST_DB ?? 'data/barghest.sqlite');
// Every imported file is kept here as the stored original (gitignored). The proofs point it at a throwaway folder.
const FILES = resolve(root, process.env.BARGHEST_FILES ?? 'data/files');
const BASE_URL = `http://localhost:${PORT}`;

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  csv: 'text/csv; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  json: 'application/json; charset=utf-8',
};

const meta = JSON.parse(readFileSync(join(root, 'ontology', 'ontology.json'), 'utf8'));
const store = openStore(DB);
const engine = createEngine({ meta, store, baseUrl: BASE_URL, actionImpls: createActionImpls(meta) });
const loaded = engine.load();
const llm = createLlm({ store });
// The two demo investigations exist from the first start; anything else is created through POST investigations.
const demoInvestigations = ensureDemoInvestigations(store);

const bad = (message) => Object.assign(new Error(message), { status: 400 });

/** The investigation a route names, or 400. Routes never take an id the store does not hold. */
function requireInvestigation(id) {
  if (!id) throw bad('investigation is required');
  const inv = store.investigation(id);
  if (!inv) throw bad(`unknown investigation: ${id}`);
  return inv;
}

/** `investigation` from a query string, with `scenario` (the property's internal name) read as an alias. */
const investigationParam = (url) => url.searchParams.get('investigation') ?? url.searchParams.get('scenario');

// Extraction runs in the background after an import (a document pack can take minutes on a 4B model); the
// Document's status says where it is: imported, extracting, extracted, extracted with gaps, extraction failed.
const jobs = new Map();
function startExtraction(documentId, investigation) {
  if (jobs.has(documentId)) return 'running';
  const doc = engine.data.getObject('Document', documentId);
  if (!doc) throw Object.assign(new Error(`document not found: ${documentId}`), { status: 404 });
  const inv = requireInvestigation(investigation);
  engine.put([{ ...doc, status: 'extracting' }]);
  const job = extractDocument({ engine, meta, store, llm, documentId, investigation: inv.id, blocks: inv.blocks })
    .then((summary) => {
      console.log(`extract ${documentId}: ${summary.passages} passages, ${summary.calls} calls, ${summary.mentions} mentions, ${summary.relationships} relationships, ${summary.failed} failed, ${summary.latencyMs} ms`);
      return summary;
    })
    .catch((e) => {
      console.error(`extract ${documentId} failed:`, e);
      const d = engine.data.getObject('Document', documentId);
      if (d) engine.put([{ ...d, status: 'extraction failed' }]);
      return { documentId, error: e?.message ?? String(e) };
    })
    .finally(() => jobs.delete(documentId));
  jobs.set(documentId, job);
  return 'started';
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** The multipart body of a request, through the WHATWG Request the bridge below also uses. */
async function formDataOf(req) {
  const request = new Request(new URL(req.url ?? '/', BASE_URL), {
    method: req.method,
    headers: new Headers(req.headers),
    duplex: 'half',
    body: Readable.toWeb(req),
  });
  return request.formData();
}

async function jsonBodyOf(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw bad('the body must be JSON');
  }
}

const routes = {
  'GET /barghest/health': async () => ({
    ok: true,
    engine: 'barghest',
    ontology: { rid: meta.ontology.rid, types: Object.keys(meta.objectTypes).length, objects: store.countByType() },
    // Ollama is only probed once the owner has said so (BARGHEST_OLLAMA=on); until then the engine never
    // touches port 11434 and this is null.
    ollama: await llm.health(),
    models: llm.allowed() ? MODELS : [],
    extracting: [...jobs.keys()],
    formats: FORMATS,
  }),
  'GET /barghest/catalog': () => ({ ontology: meta, ownership }),
  'GET /barghest/audit': (url) => {
    const objectId = url.searchParams.get('objectId');
    if (!objectId) throw bad('objectId is required');
    return store.auditFor(objectId);
  },
  'GET /barghest/inference-log': (url) => store.inferenceLog(Number(url.searchParams.get('after') ?? 0)),
  // The file view in one call: the document, its passages with what the model pulled from them, its rows, its log.
  'GET /barghest/document': (url) => {
    const documentId = url.searchParams.get('documentId');
    if (!documentId) throw bad('documentId is required');
    return documentView({ data: engine.data, meta, store, documentId, extracting: jobs.has(documentId) });
  },
  // Delete a file and everything the model pulled from it; refused while the model is reading it.
  'POST /barghest/delete-document': async (url) => {
    const documentId = url.searchParams.get('documentId');
    if (!documentId) throw bad('documentId is required');
    if (jobs.has(documentId)) throw Object.assign(new Error('the model is still reading this file; wait for it to finish'), { status: 409 });
    return deleteDocument({ engine, meta, store, documentId, filesDir: FILES, root });
  },
  // Folders: store records inside one investigation (engine-api.md 2.7). One POST per action, each audited.
  'GET /barghest/folders': (url) => listFolders(store, engine.data, requireInvestigation(investigationParam(url)).id),
  'POST /barghest/folders': async (url, req) => createFolder(store, await jsonBodyOf(req)),
  'POST /barghest/rename-folder': async (url, req) => renameFolder(store, await jsonBodyOf(req)),
  'POST /barghest/move-folder': async (url, req) => moveFolder(store, await jsonBodyOf(req)),
  'POST /barghest/delete-folder': async (url, req) => deleteFolder(store, engine.data, await jsonBodyOf(req)),
  'POST /barghest/move-document': async (url, req) => moveDocument(engine, store, await jsonBodyOf(req)),
  // Investigations: store records, outside the ontology (engine-api.md 2.6).
  'GET /barghest/investigations': () => listInvestigations(store, engine.data),
  'POST /barghest/investigations': async (url, req) => createInvestigation(store, await jsonBodyOf(req)),
  'POST /barghest/import': async (url, req) => {
    const form = await formDataOf(req);
    const file = form.get('file');
    const investigation = requireInvestigation(String(form.get('investigation') ?? form.get('scenario') ?? ''));
    const system = String(form.get('system') ?? '');
    const folderId = folderFor(store, investigation.id, String(form.get('folderId') ?? ''));
    if (!file || typeof file === 'string') throw bad('a file field is required (multipart)');
    const ext = (file.name ?? '').split('.').pop().toLowerCase();
    if (!FORMATS.includes(ext) && ext !== 'md') throw bad(`unsupported file type .${ext}; one of ${FORMATS.join(', ')}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await ingestFile({ engine, meta, store, scenario: investigation.id, filename: file.name, buffer, system, folderId, filesDir: FILES, root });
    // Nothing to read in a scan or an empty file: the reply says so and the model never starts on it.
    const extraction = result.status === 'no text' ? 'no text' : llm.allowed() && form.get('extract') !== 'no' ? startExtraction(result.documentId, investigation.id) : 'off';
    return { ...result, extraction };
  },
  // (Re)run extraction on one imported document, in the background, with its investigation's blocks. Poll the
  // Document's status or the inference log.
  'POST /barghest/extract': async (url) => {
    const documentId = url.searchParams.get('documentId');
    if (!documentId) throw bad('documentId is required');
    const doc = engine.data.getObject('Document', documentId);
    if (!doc) throw Object.assign(new Error(`document not found: ${documentId}`), { status: 404 });
    if (doc.status === 'no text') throw bad('no text to read in this file (a scan, or empty)');
    const investigation = requireInvestigation(investigationParam(url) ?? doc.scenario);
    if (!llm.allowed()) throw Object.assign(new Error('the local model is off'), { status: 503 });
    return { documentId, extraction: startExtraction(documentId, investigation.id) };
  },
  // Resolution over everything extracted so far in one investigation. The 0.5 to 0.9 band goes to the local model
  // when it is on; otherwise those pairs are written as Resolutions at "review".
  'POST /barghest/resolve': async (url) => {
    const investigation = requireInvestigation(investigationParam(url));
    const decide = llm.allowed() && url.searchParams.get('model') !== 'off' ? createDecide(llm) : null;
    return resolveScenario({ engine, meta, store, scenario: investigation.id, decide });
  },
  'GET /barghest/what-connects': (url) => {
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!from || !to) throw bad('from and to are required, as Type:pk');
    return whatConnects(engine.data, meta, from, to);
  },
  'GET /barghest/timeline': (url) => {
    const objectId = url.searchParams.get('objectId');
    if (!objectId) throw bad('objectId is required, as Type:pk');
    const hops = Math.max(0, Math.min(4, Number(url.searchParams.get('hops') ?? 2)));
    return timeline(engine.data, meta, store, objectId, { hops });
  },
  // Embeddings for every passage that has none yet (the model must be on). Without an investigation: all of them.
  'POST /barghest/embed': async (url) => {
    if (!llm.allowed()) throw Object.assign(new Error('the local model is off'), { status: 503 });
    const investigation = investigationParam(url);
    return embedAll({ engine, store, llm, scenario: investigation ? requireInvestigation(investigation).id : null });
  },
  // Passages for a question: by embedding when available, by keyword always.
  'GET /barghest/search': (url) => {
    const q = url.searchParams.get('q');
    if (!q) throw bad('q is required');
    const investigation = investigationParam(url);
    return searchPassages({ engine, store, llm, question: q, scenario: investigation ? requireInvestigation(investigation).id : null, k: Number(url.searchParams.get('k') ?? 8) });
  },
  // Ask: { question, investigation? } in; { answer, objects, relationships, citations, refused, retrieval } out.
  'POST /barghest/ask': async (url, req) => {
    const body = await jsonBodyOf(req);
    const investigation = body.investigation ?? body.scenario ?? investigationParam(url) ?? null;
    return ask({ engine, meta, store, llm, question: body.question, scenario: investigation ? requireInvestigation(investigation).id : null });
  },
};

/** GET /barghest/file?documentId=: the stored original, inline, so a PDF opens in a browser tab. Not JSON. */
function serveFile(url, res) {
  const documentId = url.searchParams.get('documentId');
  if (!documentId) throw bad('documentId is required');
  const doc = engine.data.getObject('Document', documentId);
  if (!doc) throw Object.assign(new Error(`document not found: ${documentId}`), { status: 404 });
  const file = resolve(root, String(doc.path ?? ''));
  // Only files under the app folder, and only ones that are still there.
  const inside = file.startsWith(root + sep);
  const stat = inside ? (() => { try { return statSync(file); } catch { return null; } })() : null;
  if (!stat?.isFile()) throw Object.assign(new Error(`no stored copy for ${documentId}`), { status: 404 });
  const ext = String(doc.format ?? file.split('.').pop()).toLowerCase();
  const filename = String(doc.title ?? documentId).replace(/["\\\r\n]/g, '_');
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
    'content-length': stat.size,
    'content-disposition': `inline; filename="${filename}"`,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}

const emitter = new EventEmitter();

/** Hand a request to faux: the 80-line Node-to-msw bridge from the OSDK repo (vite-plugin-oac), adapted. */
async function toFaux(req, res) {
  const method = req.method ?? 'GET';
  const hasBody = method !== 'HEAD' && method !== 'GET';
  const request = new Request(new URL(req.url ?? '/', BASE_URL), {
    method,
    headers: new Headers(req.headers),
    credentials: 'omit',
    duplex: hasBody ? 'half' : undefined,
    body: hasBody ? Readable.toWeb(req) : undefined,
  });
  await msw.handleRequest(request, crypto.randomUUID(), engine.handlers, { onUnhandledRequest: 'bypass' }, emitter, {
    resolutionContext: { baseUrl: BASE_URL },
    async onMockedResponse(mocked) {
      res.statusCode = mocked.status;
      res.statusMessage = mocked.statusText;
      mocked.headers.forEach((value, name) => res.appendHeader(name, value));
      if (mocked.body) Readable.fromWeb(mocked.body).pipe(res);
      else res.end();
    },
    onPassthroughResponse() {
      json(res, 404, { error: 'not found', path: req.url });
    },
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', BASE_URL);
  try {
    if (url.pathname.startsWith('/barghest/')) {
      if (req.method === 'GET' && url.pathname === '/barghest/file') return serveFile(url, res);
      const route = routes[`${req.method} ${url.pathname}`];
      if (!route) return json(res, 404, { error: 'not found', path: url.pathname });
      return json(res, 200, await route(url, req));
    }
    await toFaux(req, res);
  } catch (e) {
    const status = e?.status ?? 500;
    if (status >= 500) console.error(`engine: ${req.method} ${url.pathname} failed:`, e);
    else console.log(`engine: ${req.method} ${url.pathname} refused: ${e?.message ?? e}`);
    if (!res.headersSent) json(res, status, { error: e?.message ?? String(e) });
    else res.end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`barghest engine: ${BASE_URL}  ontology ${Object.keys(meta.objectTypes).length} types, ${loaded} objects from ${DB}, ${store.investigations().length} investigations${demoInvestigations ? ` (${demoInvestigations} demo created)` : ''}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close();
    store.close();
    process.exit(0);
  });
}
