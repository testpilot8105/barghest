// The BARGHEST engine: one Node http server on 8787. The /barghest/* routes are ours; everything else is handed to
// Palantir's @osdk/faux through msw, so @osdk/client talks to this process exactly as it would to Foundry. Every
// object lives in data/barghest.sqlite and is reloaded into faux at boot. The app reaches this through Vite's proxy,
// the proofs reach it directly. Ollama is called only from the ingest, resolve and ask modules (P5 onwards).
import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
import { ask, embedAll, searchPassages } from './ask/index.mjs';
import { ownership } from '../ontology/ownership.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.BARGHEST_ENGINE_PORT ?? 8787);
const DB = resolve(root, process.env.BARGHEST_DB ?? 'data/barghest.sqlite');
const BASE_URL = `http://localhost:${PORT}`;

const meta = JSON.parse(readFileSync(join(root, 'ontology', 'ontology.json'), 'utf8'));
const store = openStore(DB);
const engine = createEngine({ meta, store, baseUrl: BASE_URL, actionImpls: createActionImpls(meta) });
const loaded = engine.load();
const llm = createLlm({ store });

// Extraction runs in the background after an import (a document pack can take minutes on a 4B model); the
// Document's status says where it is: imported, extracting, extracted, extracted with gaps, extraction failed.
const jobs = new Map();
function startExtraction(documentId, scenario) {
  if (jobs.has(documentId)) return 'running';
  const doc = engine.data.getObject('Document', documentId);
  if (!doc) throw Object.assign(new Error(`document not found: ${documentId}`), { status: 404 });
  engine.put([{ ...doc, status: 'extracting' }]);
  const job = extractDocument({ engine, meta, store, llm, documentId, scenario })
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

const bad = (message) => Object.assign(new Error(message), { status: 400 });

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
  'POST /barghest/import': async (url, req) => {
    const form = await formDataOf(req);
    const file = form.get('file');
    const scenario = String(form.get('scenario') ?? '');
    const system = String(form.get('system') ?? '');
    if (!file || typeof file === 'string') throw bad('a file field is required (multipart)');
    if (scenario !== 'a' && scenario !== 'b') throw bad('scenario must be a or b');
    const ext = (file.name ?? '').split('.').pop().toLowerCase();
    if (!FORMATS.includes(ext) && ext !== 'md') throw bad(`unsupported file type .${ext}; one of ${FORMATS.join(', ')}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await ingestFile({ engine, meta, store, scenario, filename: file.name, buffer, system });
    const extraction = llm.allowed() && form.get('extract') !== 'no' ? startExtraction(result.documentId, scenario) : 'off';
    return { ...result, extraction };
  },
  // (Re)run extraction on one imported document, in the background. Poll the Document's status or the inference log.
  'POST /barghest/extract': async (url) => {
    const documentId = url.searchParams.get('documentId');
    const scenario = url.searchParams.get('scenario') ?? engine.data.getObject('Document', documentId ?? '')?.scenario ?? '';
    if (!documentId) throw bad('documentId is required');
    if (scenario !== 'a' && scenario !== 'b') throw bad('scenario must be a or b');
    if (!llm.allowed()) throw Object.assign(new Error('the local model is off'), { status: 503 });
    return { documentId, extraction: startExtraction(documentId, scenario) };
  },
  // Resolution over everything extracted so far in one scenario. The 0.5 to 0.9 band goes to the local model when
  // it is on; otherwise those pairs are written as Resolutions at "review".
  'POST /barghest/resolve': async (url) => {
    const scenario = url.searchParams.get('scenario') ?? '';
    if (scenario !== 'a' && scenario !== 'b') throw bad('scenario must be a or b');
    const decide = llm.allowed() && url.searchParams.get('model') !== 'off' ? createDecide(llm) : null;
    return resolveScenario({ engine, meta, store, scenario, decide });
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
  // Embeddings for every passage that has none yet (the model must be on).
  'POST /barghest/embed': async (url) => {
    if (!llm.allowed()) throw Object.assign(new Error('the local model is off'), { status: 503 });
    return embedAll({ engine, store, llm, scenario: url.searchParams.get('scenario') });
  },
  // Passages for a question: by embedding when available, by keyword always.
  'GET /barghest/search': (url) => {
    const q = url.searchParams.get('q');
    if (!q) throw bad('q is required');
    return searchPassages({ engine, store, llm, question: q, scenario: url.searchParams.get('scenario'), k: Number(url.searchParams.get('k') ?? 8) });
  },
  // Ask: { question, scenario? } in; { answer, objects, relationships, citations, refused, retrieval } out.
  'POST /barghest/ask': async (url, req) => {
    const body = await jsonBodyOf(req);
    return ask({ engine, meta, store, llm, question: body.question, scenario: body.scenario ?? url.searchParams.get('scenario') ?? null });
  },
};

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
  console.log(`barghest engine: ${BASE_URL}  ontology ${Object.keys(meta.objectTypes).length} types, ${loaded} objects from ${DB}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close();
    store.close();
    process.exit(0);
  });
}
