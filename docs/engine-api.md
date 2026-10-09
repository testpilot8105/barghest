# BARGHEST engine API: the contract with the screens

Version 1, written at P0 (09.10.2026). Each item names the milestone where it becomes real. Until then the call
exists and answers with an empty or stub body. The changelog is at the foot; when it changes, the owner hears in one
line.

## 1. Where things run

| Port | What |
|---|---|
| 5180 | Vite serves the app. `/api/*` and `/barghest/*` are proxied to 8787, so the app only ever calls its own origin |
| 8787 | The engine: Palantir's `@osdk/faux` (the Foundry Ontology v2 HTTP contract, in memory) behind plain Node `http`, every write persisted to `data/barghest.sqlite` and reloaded at boot; plus the `/barghest/*` routes below |
| 11434 | Ollama. The engine is its only caller; the app never talks to it |

## 2. The ontology, only through `src/data/`

The screens never import `@osdk/*` or the generated `sdk/`. Everything they need to walk the ontology is a plain
function or a React hook exported from `src/data/index.ts` (real at P3). Type, property and link names come from
`ontology/ontology.mts` and freeze when P1 is committed; a later rename is listed in the changelog.

### 2.1 Catalog (P3)

`getCatalog()` / `useCatalog()` returns, from `GET /barghest/catalog`:

- per type: `apiName`, `displayName`, `pluralDisplayName`, `primaryKey`, `titleProperty`, `ownership`
- per property: `apiName`, `displayName`, `dataType`, `array`, `ownership` (`source` | `ontology` | `derived`),
  `filterOps` (which of `eq`, `in`, `contains`, `range`, `isEmpty` apply), `histogram` (`exact` | `ranges` |
  `duration` | none)
- per link: `apiName`, `displayName`, `targetType`, `cardinality` (`one` | `many`)

### 2.2 Exploration (P3)

The current set is plain JSON. The shell keeps it in the address bar through `encodeExploration` /
`decodeExploration`, so back, forward and a pasted link all work.

```json
{ "start": "Person",
  "steps": [ { "filter": { "property": "fullName", "op": "contains", "value": "Dela" } },
             { "pivot": "digitalAccounts" },
             { "filter": { "property": "platform", "op": "eq", "value": "Discord" } } ],
  "sort": { "property": "handle", "direction": "asc" },
  "pageSize": 50 }
```

`currentType(exploration)` returns the type after the last pivot.

Filter operations: `eq`, `in`, `contains` (text, substring), `range` (`{ "min", "max" }` on numbers and timestamps),
`isEmpty`. Faux has substring search only and no geo filters; any operation faux rejects is dropped from the catalog
at P3 and listed here.

### 2.3 Reads, one call each (P3)

| Function | Hook | Returns |
|---|---|---|
| `fetchRows(exp, pageToken?)` | `useRows(exp)` with `loadMore()` | `{ rows: [{ pk, title, properties }], nextPageToken }` |
| `countRows(exp)` | `useCount(exp)` | a number |
| `histogram(exp, property)` | `useHistogram(exp, property)` | up to 20 `{ bucket, count }` plus `other` |
| `searchAround(exp)` | `useSearchAround(exp)` | per link of the current type: `{ link, targetType, count }` |
| `getObjectView(type, pk)` | `useObjectView(type, pk)` | see 2.4 |
| `searchAll(text)` | `useSearchAll(text)` | per type: `{ count, top: [{ pk, title }] }` (top 5 by title) |
| `toRefs(exp, limit)` | | `[{ type, pk }]`, for "add to graph" |

Every hook returns `{ data, loading, error }`. The app is wrapped in `BarghestDataProvider`, which owns the client.

### 2.4 Object view (P3; candidates and resolutions fill at P6)

```
{ type, pk, title,
  properties: [{ apiName, displayName, value, ownership }],
  links: [{ link, targetType, count, first: [{ pk, title }] }],
  relationships: { out: [...], in: [...] }   // each: { pk, kind, confidence, status, method, otherType, otherPk,
                                              //         otherTitle, passages: [{ pk, documentId, text }] }
  candidates: [{ pk, title, passageId }],     // the originals this canonical object was resolved from
  resolutions: [{ pk, decision, confidence, decidedBy, method, reason, candidateIds }],
  audit: [{ at, action, actor, summary }] }
```

### 2.5 Intake: import, the model log and health (real, 09.10.2026)

The Files and Data Sources views call the engine only through these. Every call that the engine refuses throws an
`EngineError` carrying `status` and the engine's own message, so a screen can say why.

| Function | Hook | Underneath | Returns |
|---|---|---|---|
| `importFile(dc, { file, investigation, system?, folderId?, extract? })` | | `POST import` | `{ documentId, format, passages, records, pages, chars, status, path, extraction }`. `status` is `imported`, or `no text` when the file yielded no characters (a scanned PDF): then nothing is read and `extraction` is `no text`. Otherwise `extraction` is `started`, `running` or `off`. `extract: false` stores the file without reading it |
| `extractAgain(dc, documentId)` | | `POST extract?documentId=` | `{ documentId, extraction }`. With the model off it fails with status 503; on a `no text` document with 400 |
| `fileUrl(dc, documentId)` | | `GET file?documentId=` | the URL of the stored original, for an "Open original" link that opens in a new tab (a PDF renders in the browser) |
| `getDocumentView(dc, documentId)` | `useDocumentView(documentId)`, with `reload()` | `GET document?documentId=` | the file view in one call (section 3). While `document.extracting` is true the hook asks again every two seconds, so passages fill in as the model finishes them; call `reload()` after `extractAgain` |
| `deleteDocument(dc, documentId)` | | `POST delete-document?documentId=` | removes the file and everything the model pulled from it (section 3); `{ documentId, removed: { passages, records, mentions, relationships, embeddings, storedFile }, trimmedRelationships, resolved }`. 409 while the file is being read |
| `fetchInferenceLog(dc, after)` | `useInferenceLog(intervalMs = 2000)` | `GET inference-log?after=` | rows in id order. The hook polls, appends only rows newer than what it holds, never repeats one, and catches up in one go after a long gap |
| `getHealth(dc)` | `useHealth(intervalMs = 2000)` | `GET health` | the health body of section 3 |
| | `useExtracting()` | `health.extracting` | the document ids the model is reading now, polled |

- `investigation` is an id from `GET investigations` (section 2.6); the engine refuses one it does not hold. It
  travels as the form field `investigation` (`scenario`, the Document property's internal name, is still read as an
  alias).
- `folderId` is sent as a form field and ignored until folders land (step 6).
- The file list is the exploration reads on `Document`: `startExploration('Document')` with a filter step
  `scenario eq <investigation>`, and the histogram on `Document.system` groups the files by register. Both run on
  faux 0.57 and are checked in `proof:explorer`.

### 2.6 Investigations (real, 09.10.2026)

An investigation is a record in the store, not an ontology object: `{ id, name, template, blocks, documents,
createdAt }`. Its `id` is fixed for life (a URL-safe slug of the first name plus a short hash) and is what the
address bar, every object's `scenario` property and every route carry; its `name` is a label that step 7 lets the
analyst change. The two demo investigations exist from the first engine start: `school-incident` ("School
incident") and `solid-waste` ("Solid waste"). Screens show the name, never the id.

| Function | Hook | Underneath | Returns |
|---|---|---|---|
| `getInvestigations(dc)` | `useInvestigations()`, with `reload()` | `GET investigations` | `{ investigations, templates, blocks }`: every investigation with its document count, the three templates (`school-incident`, `solid-waste`, `general`) with their blocks, and the block list `[{ id, label, types }]` for the "What to look for" checkboxes |
| `createInvestigation(dc, { name, template?, blocks? })` | | `POST investigations` | the new investigation. `blocks` win over `template`; neither means `general`. An empty name or an unknown block is refused with 400 |

What an investigation looks for is its `blocks`, each one kind of thing the model lists (`persons`, `firearms`,
`haulers`, `others` and so on, section 3). The two demo investigations carry exactly their template's blocks and
produce exactly the extraction schema and prompt they did before (checked byte for byte against
`engine/extract/snapshots/` in `proof:investigations`).

### 2.7 Folders (real, 09.10.2026)

Folders are store records inside one investigation, the way Compass folders are not ontology objects:
`{ id, name, parentId, investigation }`, `parentId` empty at the top level. A file lives in one folder: the
Document's `folderId` (an ontology-owned property, empty at the top level). Folders and files never cross
investigations. Every change writes an audit row with the old and the new value. A folder's `id` is a slug of its
first name plus a short hash and never changes, so the address bar's `?folder=` survives a rename.

| Function | Hook | Underneath | Returns |
|---|---|---|---|
| `getFolders(dc, investigation)` | `useFolders(investigation)`, with `reload()` | `GET folders?investigation=` | `{ investigation, folders: [{ id, name, parentId, files, subfolders }], topLevelFiles }`, a flat list the shell builds the tree from |
| `createFolder(dc, { investigation, name, parentId? })` | | `POST folders` | the new folder |
| `renameFolder(dc, folderId, name)` | | `POST rename-folder` | the folder |
| `moveFolder(dc, folderId, parentId)` | | `POST move-folder` | the folder; empty `parentId` is the top level. Refused into itself or one of its own subfolders |
| `deleteFolder(dc, folderId)` | | `POST delete-folder` | `{ folderId, deleted: true }`. Refused (409, "Move or delete what's inside first.") unless it holds no files and no subfolders |
| `moveDocument(dc, documentId, folderId)` | | `POST move-document` | `{ documentId, folderId }`; empty `folderId` is the top level |

`importFile` takes `folderId`; a folder from another investigation is refused. The file view's `folder` is
`{ id, name }` or `null` at the top level. The list of files in a folder is the Document exploration with a filter
step `folderId eq <id>` (`isEmpty` for the top level) beside the `scenario` filter.

## 3. Endpoints under `/barghest/`

| Endpoint | Returns | Real at |
|---|---|---|
| `GET health` | `{ ok, engine, ontology: { rid, types, objects }, ollama, models }` (`ollama` is `null` until P5 checks it) | real (Ollama part at P5) |
| `GET catalog` | `{ ontology, ownership }`: the engine's `ontology.json` and `ontology/ownership.ts`; `src/data/` shapes it into 2.1 | real |
| `GET audit?objectId=Type:pk` | action history for one object: `[{ id, at, action, actor, outcome, params, edits, objectIds }]` | real |
| `GET investigations` | `{ investigations: [{ id, name, template, blocks, documents, createdAt }], templates: [{ id, name, blocks }], blocks: [{ id, label, types }] }`. The blocks, in the order schemas and prompts list them: `persons` People (Person), `organizations` Organisations (Organization), `locations` Places (Location), `events` Events (Event), `incidents` Incidents (Incident), `accounts` Online accounts (DigitalAccount), `groups` Online groups (OnlineGroup), `firearms` Firearms (Firearm), `evidence` Evidence items (EvidenceItem), `schools` Schools (School), `lgus` LGUs (LGU), `barangays` Barangays (Barangay), `haulers` Haulers (Hauler), `contracts` Contracts (Contract), `facilities` Facilities (Facility), `vehicles` Vehicles (Vehicle), `inspections` Inspections (Inspection), `complaints` Complaints (Complaint), `others` Other things (Thing) | real |
| `POST investigations` | JSON `{ name, template?, blocks? }` in; the new investigation out. The id is a URL-safe slug of the name plus a short hash and never changes. Writes an audit row (`createInvestigation`, `objectIds: ["Investigation:<id>"]`). 400 on an empty name, an unknown template or an unknown block | real |
| `GET folders?investigation=` | `{ investigation, folders: [{ id, name, parentId, files, subfolders }], topLevelFiles }`: every folder of the investigation as a flat list (`parentId` empty at the top level), each with its direct file and subfolder counts, plus the count of files at the top level. 400 for an unknown investigation | real |
| `POST folders` | JSON `{ investigation, name, parentId? }` in; the new folder `{ id, name, parentId, investigation }` out. 400 on an empty name, an unknown investigation or parent, a parent from another investigation, or a sibling with the same name. Audit row `createFolder` | real |
| `POST rename-folder` | JSON `{ folderId, name }`; the folder. 400 on an empty name or a sibling with the same name. Audit row `renameFolder` with the old and the new name | real |
| `POST move-folder` | JSON `{ folderId, parentId }` (empty `parentId` is the top level); the folder. 400 when the new parent is the folder itself, one of its own subfolders, another investigation's folder, or holds a sibling with the same name. Audit row `moveFolder` with the old and the new parent | real |
| `POST delete-folder` | JSON `{ folderId }`; `{ folderId, deleted: true }`. 409 with "Move or delete what's inside first." unless the folder holds no files and no subfolders. Audit row `deleteFolder` | real |
| `POST move-document` | JSON `{ documentId, folderId }` (empty is the top level); `{ documentId, folderId }`. 400 when the folder belongs to another investigation. Audit row `moveDocument` with the old and the new folder | real |
| `POST import` | multipart: `file`, `investigation` (an id from `GET investigations`; `scenario` is read as an alias), optional `system`, optional `folderId` (a folder of that investigation; another investigation's is 400; empty is the top level), `extract=no` to store without reading; `{ documentId, format, passages, records, pages, chars, status, path, extraction }` out. The bytes are kept as the stored original at `data/files/<documentId>.<ext>` (`path`; gitignored, never in the public repo) and the file becomes a Document, its Passages (about 300 tokens each, with character offsets) and one SourceRecord per table row. A file that yields no characters (a scanned PDF, an empty file) gets `status: "no text"` and `extraction: "no text"`, and the model never starts on it. Same file again: same Document, no duplicate. Accepts pdf, csv, txt, md, json; anything else is 400; an unknown investigation is 400 | real |
| `GET file?documentId=` | streams the stored original with its content type (`application/pdf`, `text/csv`, `text/plain`, `text/markdown`, `application/json`) and `content-disposition: inline`, so a PDF opens in a browser tab. 400 without an id, 404 for an unknown document or a missing copy | real |
| `GET document?documentId=` | the file view in one call: `{ document, folder, passages, records, inference }`. `document` is the Document's properties plus `extracting` (true while the model is reading it). `folder` is `{ id, name }`, or `null` at the top level. `passages` in index order, each `{ pk, index, text, charStart, charEnd, mentions, relationships }`: `mentions` are the objects whose `passageId` points at that passage, as `{ type, pk, title, canonicalId }` (a mention carries no confidence of its own; links do), sorted by title; `relationships` are the Relationships citing that passage, as `{ pk, kind, kindLabel, label, from: { type, pk, title }, to: { type, pk, title }, confidence, status, method }`, with `from` and `to` the mentions as the passage names them. `records` are the table rows, `{ pk, label, observedAt, system, mentions }`, mentions by `recordId`. `inference` is this document's inference-log rows, oldest first. 400 without an id, 404 for an unknown document | real |
| `POST delete-document?documentId=` | writes an audit row (`deleteDocument`, by the analyst, naming the file), then removes the Document, its Passages and SourceRecords, every mention that came from them (any entity whose `passageId` or `recordId` points into the file), their embeddings, and the stored copy (only a copy under `data/files/`; a pack's own source file is never touched). A Relationship cited only by this file is deleted; one also cited elsewhere just loses this file's passage ids. Then resolution runs again for the investigation without the model, reusing every earlier model decision whose two sides survive, so no canonical object or Resolution points at a deleted mention. Inference-log rows stay, as history. Reply: `{ documentId, removed: { passages, records, mentions, relationships, embeddings, storedFile }, trimmedRelationships, resolved }`. 400 without an id, 404 for an unknown document, 409 while the file is being read | real |
| `GET inference-log?after=` | rows of `{ id, at, model, purpose, documentId, passageId, promptHash, latencyMs, promptTokens, outputTokens, ok }` | real (rows appear once the model runs, P5) |
| `POST extract?documentId=` | re-runs extraction on one document with its investigation's blocks, in the background; `{ documentId, extraction }`. 503 with the model off; 400 on a `no text` document | real |
| `POST resolve?investigation=` | runs entity resolution over the investigation's mentions: `{ scenario, summary: { <Type>: { mentions, pairs, autoPairs, modelPairs, reviewPairs, clusters, canonical } }, owners, repointedRelationships, written }` (`scenario` in the reply is the investigation id; `?scenario=` is read as an alias) | real (rule half); the 0.5 to 0.9 band goes to the model at P6 |
| `GET what-connects?from=&to=` | `{ found, hops, paths: [{ hops, objects, relationships, steps }], objects, relationships, passages }`: up to five of the shortest paths (the shortest plus two hops at most), so "same school" and "took the firearm recovered at the scene" both come back. `objects` are `{ type, pk, title }`; `relationships` carry kind, confidence, status, method, from, to and `passageIds`; `passages` are the union of their evidence. Documents, passages, records and resolutions are never nodes | real |
| `GET timeline?objectId=&hops=2` | `{ objectId, hops, objects, events }`; events of `{ id, at, kind, summary, tag, confidence, status, objectIds, passageIds }` in time order. A Relationship between two objects is one hop. `tag`: `observed` (a dated relationship, incident, event, complaint, inspection), `system` (a relationship with method `system`, such as the deletion gap, or an engine action), `analyst` (an analyst action from the audit log) | real |
| `POST ask` | JSON `{ question, investigation? }` in; `{ question, answer, objects: [{ type, pk, title, detail }], relationships, citations: [{ passageId, quote, verbatim }], refused, retrieval: { terms, semantic, passages }, model, latencyMs }` out. Retrieval is deterministic (objects by id or title, the path between the two best matches, passages by embedding and by keyword); one model call answers from that material only; citations are checked against it; nothing found means `refused: true` and "no supporting records" without a model call. With the model off it still returns what it found, refused | real (retrieval and refusal); the answer itself needs the model |
| `GET search?q=&investigation=&k=` | `{ terms, semantic, passages: [{ pk, documentId, label, text, score, how }] }`, `how` is `semantic` or `keyword` | real (keyword); semantic once embeddings exist |
| `POST embed?investigation=` | embeds every passage without an embedding (`nomic-embed-text`), `{ embedded, total }` | needs the model |

`from`, `to` and `objectId` are `"<Type>:<pk>"`. Wherever a route takes `investigation`, it is an id from
`GET investigations`; `scenario` is still read as an alias of the same thing. `ask`, `search` and `embed` take it
optionally and cover every investigation without it.

## 4. Design notes

- Relationships are objects, because faux links carry no properties. `Relationship` has one optional `from<Type>Id`
  and `to<Type>Id` per entity type, each with its link, so a plain pivot walks Person to `relationshipsFrom` to
  `toFirearm`, and Search Around gets one count per link.
- Provenance you can walk to: extraction writes one candidate object per mention with `passageId`; resolution sets
  `canonicalId` on each candidate and writes a `Resolution`. Canonical objects have an empty `canonicalId`.
- Ownership is data in `ontology/ownership.ts`; actions refuse writes to `source` fields.
- Persistence is write-through: after every action the objects it touched are upserted into SQLite; ingestion and
  resolution write rows directly. The whole store reloads into faux at boot.
- `@osdk/react` is not used: its peer dependencies pull a newer OSDK set than the pinned one. The hooks are a small
  `useAsync` over the plain functions.
- `pnpm dev` is a small spawn script, not pnpm's regex runner, because concurrent regex runs only arrived in pnpm 12.
- Every imported file is kept as a stored original at `data/files/<documentId>.<ext>` (`BARGHEST_FILES` moves the
  folder; the proofs point it at a throwaway one). The Document's `path` is that copy, relative to the app. The
  folder is gitignored: what a judge uploads never reaches the public repo. The two packs still ship from
  `data/school-incident/sources/` and `data/solid-waste/sources/`; importing one makes a copy like any other file.

## 5. Names, as frozen at P1

The object types, each with its key and title: Document (documentId, title), Passage (passageId, label), SourceRecord
(recordId, label), Person (personId, fullName), Organization (organizationId, name), Location (locationId, name),
Event (eventId, summary), DigitalAccount (accountId, handle), OnlineGroup (groupId, name), Incident (incidentId,
label), Firearm (firearmId, label), EvidenceItem (evidenceId, tag), School (schoolId, name), LGU (lguId, name),
Barangay (barangayId, name), Hauler (haulerId, name), Contract (contractId, contractNo), Facility (facilityId, name),
Vehicle (vehicleId, plateNo), Inspection (inspectionId, label), Complaint (complaintId, label), Thing (thingId,
name; display name "Other thing", added 09.10.2026 for the `others` block: `kind` is the model's own label for what
it is), Relationship (relationshipId, label), Resolution (resolutionId, label).

Every entity type (all but Document, Passage, SourceRecord, Relationship, Resolution) carries `canonicalId`,
`passageId`, `recordId`, `scenario`, and the links `canonical`, `candidates`, `passage`, `sourceRecord`,
`relationshipsFrom`, `relationshipsTo`. `scenario` keeps its internal name but its display name is "Investigation"
and its value is the investigation id (`school-incident`, `solid-waste`, or a created one), on every entity, on
Document, Relationship and Resolution. Relationship carries `kindLabel` ("Kind, as written": the passage's own
words for a `related_to` link, such as "paid" or "met with"; empty for every other kind) and `from<Type>Id` /
`to<Type>Id` per entity type with the
links `from<Type>` / `to<Type>`; the catalog marks those keys `hidden`. Document carries `folderId` ("Folder",
ontology-owned, added 09.10.2026): the folder it lives in, empty at the top level. The one-hop links: Person.digitalAccounts /
DigitalAccount.owner, Person.school / School.people, Person.firearmsRegistered / Firearm.registeredTo,
Person.firearmsInCustody / Firearm.custodian, Organization.firearms / Firearm.registeredAgency,
Firearm.evidenceItems / EvidenceItem.matchedTo, Incident.evidenceItems / EvidenceItem.recoveredAt,
Location.events / Event.location, Location.incidents / Incident.location, School.incidents / Incident.school,
Document.passages / Passage.document, Document.records / SourceRecord.document, LGU.barangays / Barangay.lgu,
LGU.facilities / Facility.lgu, LGU.contracts / Contract.lgu, Hauler.contracts / Contract.hauler, Hauler.vehicles /
Vehicle.hauler, Facility.inspections / Inspection.facility, Hauler.inspections / Inspection.hauler,
Barangay.complaints / Complaint.barangay.

Actions (camel case, as the generated SDK names them): `createObjectPerson`, `createObjectResolution`,
`modifyObjectRelationship` (status and reviewNote only).

## Changelog

- 09.10.2026, v1: written at P0.
- 09.10.2026, P1: names frozen (section 5). Actions are camel case. `health` now reports the ontology and object
  counts.
- 09.10.2026, P3: `catalog` and `audit` are real. The object view gained `passages` (a Relationship's own evidence,
  or the passage a candidate came from) and `canonical`. `range` sends one clause per bound. No filter operation had
  to be dropped: `eq`, `in`, `contains`, `range` and `isEmpty` all run on faux 0.57 for text, arrays, numbers and
  timestamps. Helpers added: `startExploration`, `withStep`, `typeAt`.
- 09.10.2026, P5 (ingest half): `import` and `inference-log` are real; `health` lists the accepted `formats`.
  Extraction (the model) is the other half and waits for the owner's go on Ollama.
- 09.10.2026, P6 (rule half): `resolve` is real. How resolution shapes the data: a mention (an extracted object
  with `passageId` or `recordId`) joins a cluster; a cluster of two or more gets a canonical object (no `passageId`,
  `canonicalId` empty, every spelling kept in `aliases`) and each member's `canonicalId` points at it. One Resolution
  per decided pair (`decidedBy` is `rule`, `local-model` or `pending`; `decision` is `same`, `different` or
  `review`). Relationships keep `fromId` / `toId` as extracted and get `from<Type>Id` / `to<Type>Id` re-pointed at
  the canonical objects, so the graph has one node per real thing. Canonical ids are deterministic
  (`P-<hash of members>`), so a re-run is idempotent.
- 09.10.2026, P8: `what-connects` and `timeline` are real. The seed gained EvidenceItems E-001 and E-002 (the
  recovered firearms), so P-001 reaches I-001 through the firearm chain as well as through the school.
- 09.10.2026, model side wired. The model is on by default and loaded on demand (owner's rule: Ollama idles as a
  service, the model unloads 2 minutes after its last call); `BARGHEST_OLLAMA=off` keeps an engine away from it.
  With it on, `import` starts extraction in the background (`extraction: "started"`; the Document's
  `status` goes `imported`, `extracting`, `extracted`, `extracted with gaps` or `extraction failed`; `extract=no`
  in the form skips it), `POST extract?documentId=` re-runs it, `resolve` asks the model about the 0.5 to 0.9
  pairs (`model=off` to skip), `health.ollama` reports `{ up, host, models, chat, embed }` and `health.extracting`
  lists documents in flight. With it off: `extraction: "off"`, `health.ollama` is `null`, and `extract` is 503.
- 09.10.2026, P9 written, gated: `ask`, `search` and `embed`. No agent loop: retrieve, then one call with the
  answer schema; citations verified; refusal without evidence. Keyword retrieval and refusal are proven with the
  model off; the answer and semantic search run once the model is on.
- 09.10.2026, two fixes from the other sessions. Passages: a long block is cut on its own lines before the
  sentence pass, so table rows, chat lines and JSON rows are never dropped (reported by the case-files session).
  Pivots: faux returns one result per link, so a many-to-one hop repeated objects in rows, counts and histograms;
  every pivot in `src/data/` is now the pivot unioned with itself, which faux dedupes, so a hop returns distinct
  objects as Foundry would (reported by the shell session). Both have regression checks in the proofs.
- 09.10.2026, accounts to people: `resolve` now ends with an ownership pass (`owners` in its reply). An account
  with no owner is matched against the scenario's canonical people by display name and handle: a full name is a
  rule call, a first name plus initials ("Joaquin DP") or a handle carrying an alias goes to the model, and "same"
  sets the account's `personId` and writes a Resolution (`candidateIds: ["DigitalAccount:<pk>"]`, `canonicalType:
  "Person"`). The account is never merged into anything.
- 09.10.2026, the model side proven (`pnpm proof:pipeline`, 19 checks, with `qwen3:4b-instruct` and
  `nomic-embed-text` on this Mac): three fictional files through import, extraction, resolution with the model
  deciding the unsure pairs, embeddings, semantic search and one question answered with three verbatim citations,
  an unrelated question refused, 18 inference-log rows. What it costs on an M4 with 16 GB: about 60 seconds of
  extraction per passage of 300 tokens when calls queue one at a time, a 17 second answer, about 2 GB of memory
  while the model is loaded. Import keeps answering while extraction runs in the background; a full document pack
  is imported ahead of a demo, and one file is imported live.
- 09.10.2026, file manager step 1: section 2.5. The data layer wraps `import`, `extract`, `inference-log` and
  `health` as `importFile`, `extractAgain`, `fetchInferenceLog` / `useInferenceLog`, `getHealth` / `useHealth` and
  `useExtracting`. A refused engine call throws `EngineError` with `status`. The Document filter by `scenario` and
  the histogram on `Document.system` are confirmed on faux and checked in `proof:explorer`. No route changed.
- 09.10.2026, file manager step 2: investigations. The letters are retired: the two demo investigations are
  `school-incident` and `solid-waste` (the shell's default investigation becomes the first one `GET investigations`
  lists). An investigation is a store record (section 2.6) built from blocks; `GET` and `POST investigations` are
  real; `import`, `extract`, `resolve`, `embed`, `search` and `ask` take `investigation` (`scenario` still read) and
  refuse an id the engine does not hold. Extraction schemas and prompts are built from the investigation's blocks;
  the two demo templates produce byte-identical output to before (snapshots in `engine/extract/snapshots/`). New
  names (section 5): the `Thing` type ("Other thing") for the `others` block, `Relationship.kindLabel` for the
  `related_to` kind, and the display name "Investigation" on every `scenario` property. The pack folders are
  `data/school-incident/` and `data/solid-waste/`.
- 09.10.2026, file manager step 3: the original is kept and served. `import` stores the bytes at
  `data/files/<documentId>.<ext>` and answers `status` and `path`; a file with no text gets `status: "no text"`,
  `extraction: "no text"`, and `extract` refuses it with 400. `GET file?documentId=` streams the stored original
  inline with its content type; `fileUrl(dc, documentId)` in the data layer.
- 09.10.2026, file manager step 4: `GET document?documentId=` is the file view in one call (the document with
  `extracting`, `folder` null until step 6, passages with their mentions and relationships, records with their
  mentions, the document's inference-log rows); `getDocumentView` / `useDocumentView` in the data layer, the hook
  polling while the model reads the file.
- 09.10.2026, file manager step 5: `POST delete-document?documentId=` removes a file and everything the model
  pulled from it, trims shared Relationships, deletes the stored copy, and re-resolves the investigation without the
  model while keeping earlier model decisions; `deleteDocument` in the data layer. The live demo file can now be
  imported in rehearsal and wiped before the judges.
- 09.10.2026, file manager step 6: folders (section 2.7). Store records per investigation with a fixed id; the
  Document gained `folderId`; `GET folders`, `POST folders`, `rename-folder`, `move-folder`, `delete-folder` and
  `move-document`, each writing an audit row with the old and the new value; `import` honours `folderId`; the file
  view's `folder` is filled. Data layer: `getFolders` / `useFolders`, `createFolder`, `renameFolder`, `moveFolder`,
  `deleteFolder`, `moveDocument`.
