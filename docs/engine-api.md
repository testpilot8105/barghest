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

## 3. Endpoints under `/barghest/`

| Endpoint | Returns | Real at |
|---|---|---|
| `GET health` | `{ ok, engine, ontology: { rid, types, objects }, ollama, models }` (`ollama` is `null` until P5 checks it) | real (Ollama part at P5) |
| `GET catalog` | `{ ontology, ownership }`: the engine's `ontology.json` and `ontology/ownership.ts`; `src/data/` shapes it into 2.1 | real |
| `GET audit?objectId=Type:pk` | action history for one object: `[{ id, at, action, actor, outcome, params, edits, objectIds }]` | real |
| `POST import` | multipart: `file`, `scenario` (`a` or `b`), optional `system` in; `{ documentId, format, passages, records, pages, chars }` out. The file becomes a Document, its Passages (about 300 tokens each, with character offsets) and one SourceRecord per table row. Same file again: same Document, no duplicate. Accepts pdf, csv, txt, md, json; anything else is 400 | real (extraction after it runs at P5) |
| `GET inference-log?after=` | rows of `{ id, at, model, purpose, documentId, passageId, promptHash, latencyMs, promptTokens, outputTokens, ok }` | real (rows appear once the model runs, P5) |
| `POST resolve?scenario=` | runs entity resolution over the scenario's mentions: `{ scenario, summary: { <Type>: { mentions, pairs, autoPairs, modelPairs, reviewPairs, clusters, canonical } }, repointedRelationships, written }` | real (rule half); the 0.5 to 0.9 band goes to the model at P6 |
| `GET what-connects?from=&to=` | `{ found, hops, paths: [{ hops, objects, relationships, steps }], objects, relationships, passages }`: up to five of the shortest paths (the shortest plus two hops at most), so "same school" and "took the firearm recovered at the scene" both come back. `objects` are `{ type, pk, title }`; `relationships` carry kind, confidence, status, method, from, to and `passageIds`; `passages` are the union of their evidence. Documents, passages, records and resolutions are never nodes | real |
| `GET timeline?objectId=&hops=2` | `{ objectId, hops, objects, events }`; events of `{ id, at, kind, summary, tag, confidence, status, objectIds, passageIds }` in time order. A Relationship between two objects is one hop. `tag`: `observed` (a dated relationship, incident, event, complaint, inspection), `system` (a relationship with method `system`, such as the deletion gap, or an engine action), `analyst` (an analyst action from the audit log) | real |
| `POST ask` | JSON `{ question, scenario? }` in; `{ question, answer, objects: [{ type, pk, title, detail }], relationships, citations: [{ passageId, quote, verbatim }], refused, retrieval: { terms, semantic, passages }, model, latencyMs }` out. Retrieval is deterministic (objects by id or title, the path between the two best matches, passages by embedding and by keyword); one model call answers from that material only; citations are checked against it; nothing found means `refused: true` and "no supporting records" without a model call. With the model off it still returns what it found, refused | real (retrieval and refusal); the answer itself needs the model |
| `GET search?q=&scenario=&k=` | `{ terms, semantic, passages: [{ pk, documentId, label, text, score, how }] }`, `how` is `semantic` or `keyword` | real (keyword); semantic once embeddings exist |
| `POST embed?scenario=` | embeds every passage without an embedding (`nomic-embed-text`), `{ embedded, total }` | needs the model |

`from`, `to` and `objectId` are `"<Type>:<pk>"`.

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

## 5. Names, as frozen at P1

The object types, each with its key and title: Document (documentId, title), Passage (passageId, label), SourceRecord
(recordId, label), Person (personId, fullName), Organization (organizationId, name), Location (locationId, name),
Event (eventId, summary), DigitalAccount (accountId, handle), OnlineGroup (groupId, name), Incident (incidentId,
label), Firearm (firearmId, label), EvidenceItem (evidenceId, tag), School (schoolId, name), LGU (lguId, name),
Barangay (barangayId, name), Hauler (haulerId, name), Contract (contractId, contractNo), Facility (facilityId, name),
Vehicle (vehicleId, plateNo), Inspection (inspectionId, label), Complaint (complaintId, label), Relationship
(relationshipId, label), Resolution (resolutionId, label).

Every entity type (all but Document, Passage, SourceRecord, Relationship, Resolution) carries `canonicalId`,
`passageId`, `recordId`, `scenario`, and the links `canonical`, `candidates`, `passage`, `sourceRecord`,
`relationshipsFrom`, `relationshipsTo`. Relationship carries `from<Type>Id` / `to<Type>Id` per entity type with the
links `from<Type>` / `to<Type>`; the catalog marks those keys `hidden`. The one-hop links: Person.digitalAccounts /
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
- 09.10.2026, model side wired, gated: the engine calls Ollama only when started with `BARGHEST_OLLAMA=on` (the
  owner's go). With it on, `import` starts extraction in the background (`extraction: "started"`; the Document's
  `status` goes `imported`, `extracting`, `extracted`, `extracted with gaps` or `extraction failed`; `extract=no`
  in the form skips it), `POST extract?documentId=` re-runs it, `resolve` asks the model about the 0.5 to 0.9
  pairs (`model=off` to skip), `health.ollama` reports `{ up, host, models, chat, embed }` and `health.extracting`
  lists documents in flight. With it off: `extraction: "off"`, `health.ollama` is `null`, and `extract` is 503.
- 09.10.2026, P9 written, gated: `ask`, `search` and `embed`. No agent loop: retrieve, then one call with the
  answer schema; citations verified; refusal without evidence. Keyword retrieval and refusal are proven with the
  model off; the answer and semantic search run once the model is on.
