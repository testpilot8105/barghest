<p align="center"><img src="public/barghest-lockup-on-black.svg" alt="BARGHEST" width="360"></p>

# BARGHEST

**A local-AI intelligence workbench. It brings the intelligence to the data, instead of sending the data to the
intelligence.**

BARGHEST turns a folder of documents and records that disagree with each other (police reports, school registers,
chat exports, contracts, audit memos) into one connected, explorable model of people, organisations, places, events
and evidence. A language model running on the analyst's own laptop reads every passage. Rules and the model together
decide which mentions are the same person or thing. The analyst then works the result in an Object Explorer, an
Entity Profile, a Graph, a Timeline and an Assistant that answers only from cited passages.

Built for the AppBuildersPH Hackathon 2026 (theme: Local AI), 9 to 10 October 2026.

## Who it is for

An investigator or analyst in a Philippine public office: a police investigator, a provincial environment officer,
an auditor. They hold records that cannot leave the building, and they work where the connection cannot be trusted.

Two demo investigations ship with the repo, both fully synthetic:

| Investigation | The question it answers |
|---|---|
| School incident (`data/school-incident/`, 14 files) | One subject appears under a full name, initials, a nickname and four online handles across police, DepEd, Discord, Messenger, Roblox and TikTok records. Who is he, and what connects him to the incident? |
| Solid waste (`data/solid-waste/`, 11 files) | One hauler appears under 12 spellings across three LGUs' plans, PhilGEPS awards, trip logs, EMB letters and a COA memo. Which hauler serves more than one LGU, and what did the inspections say? |

Every person, school, LGU, company, account and number in the data is invented. Each pack's `ANSWERS.md` lists the
planted links, so the extraction can be checked against a known answer.

## Why local

| Reason | Why it is true for these users |
|---|---|
| The records cannot leave the machine | Records of minors (DepEd LIS), police blotters, forensic reports, firearm registrations, LGU contracts under audit. Sending them to a cloud model is a data-handling violation (Data Privacy Act, RA 10173) before it is a product choice |
| The connection cannot be trusted | Provincial offices, field inspections, a precinct during an incident. BARGHEST runs with Wi-Fi off |
| The cost has to be zero per document | An LGU has no per-token budget. A 4B model on a laptop reads a document pack for the price of electricity |
| The evidence has to stay inspectable | Every extracted fact links back to the passage it came from, stored in the analyst's own database. Every model call is logged on the machine with its model, prompt hash, latency and tokens. There is no vendor between the analyst and the source |

## What runs locally, and what needs internet

| | |
|---|---|
| **Runs locally, always** | All AI inference: passage extraction (`qwen3:4b-instruct`), entity-resolution decisions, embeddings (`nomic-embed-text`) and the Assistant's answers, through Ollama on `localhost:11434`. Parsing, the ontology engine, the database (SQLite), search, graph and timeline |
| **Needs internet** | Only setup: `pnpm install` and downloading the two models (about 2.6 GB, once). After that BARGHEST runs with Wi-Fi off |
| **Cloud AI APIs** | None. The engine's only network call is to Ollama on the same machine |

## How it works

```
data/<investigation>/sources/   PDF, TXT, CSV, JSON, MD, plus photos
        |
engine/ingest/     parse (pdfjs-dist, papaparse), split into passages, keep each file's identity
engine/extract/    local model, one passage at a time, JSON schema in Ollama's `format`, validated with zod
engine/resolve/    normalise names and handles, rule-based candidate pairs, auto-merge at 0.9 or above,
                   the local model decides the unsure pairs; every merge is recorded as a Resolution
ontology/          the ontology as code (Palantir's @osdk/maker), compiled to a typed SDK
engine/server.mjs  Palantir's @osdk/faux serves the ontology over HTTP from SQLite (node:sqlite)
engine/ask/        keyword + semantic retrieval, graph paths, one grounded answer with a citation check
src/               the workbench (React, Blueprint): Files, Data Sources, Object Explorer, Profile, Graph,
                   Timeline, Assistant
```

## Run it

You need Node 22.18 or newer, [Ollama](https://ollama.com/download) and about 3 GB of free disk. Tested on an
Apple Silicon Mac with 16 GB of memory.

**On a Mac:** double-click `Start BARGHEST.command`. The first run installs the packages and downloads the two models,
then opens `http://localhost:5180`.

**Anywhere, by hand:**

```sh
ollama pull qwen3:4b-instruct
ollama pull nomic-embed-text
pnpm install                      # or: npx pnpm install
BARGHEST_OLLAMA=on pnpm dev       # engine on 8787, app on 5180
```

Open `http://localhost:5180`. The store starts empty.

**Load a demo investigation** (in a second terminal, with `pnpm dev` running):

```sh
pnpm import:pack school-incident  # about 35 minutes with the model on: about a minute per passage
pnpm import:pack solid-waste      # about 37 minutes
```

Then open the investigation in the app and watch Data Sources fill. Add `--skip-live` to leave out the one file per
pack the live demo imports on stage. You can also import any PDF, TXT, CSV, JSON or MD file from the Files screen.

**Checks that need no model** (each starts its own throwaway engine and cleans up after itself):

```sh
BARGHEST_OLLAMA=off node engine/proof-pack.mjs   # both packs import into the right folders, demo questions keep their terms
pnpm proof:ingest
pnpm proof:files
pnpm build                                       # typecheck and production build
```

## Measured on the demo packs (Apple M4, 16 GB)

| What | Result |
|---|---|
| Extraction speed | About 60 seconds per passage (about 1,200 characters) |
| School incident import | 13 files, 24 passages, 33 minutes |
| Solid waste import | 10 files, 23 passages, 37 minutes |
| Embedding | 48 passages in 10 seconds |
| Live file on stage | Firearms report 44 seconds (all 16 evidence tags tied to their pistol); hauling contracts 20 seconds |
| Assistant answer | 26 to 27 seconds per question, with citations |
| Planted links, school incident | 34 planted: 15 found, 11 found as another kind of link, 8 missed |
| Planted links, solid waste | 36 planted: 20 found, 2 found as another kind of link, 14 missed |
| Memory | About 2 GB while a model is loaded; it unloads 2 minutes after the last call |

The misses and their causes are written up in `Session Logs/10.10.2026.md` (section "Plumbing 2: P7"). The limits
are in [`docs/limitations.md`](docs/limitations.md).

## Disclosures

**Models**

| Model | Role | Licence |
|---|---|---|
| Qwen3 4B Instruct (`qwen3:4b-instruct`, via Ollama) | extraction, entity-resolution decisions, answers | Apache 2.0 |
| nomic-embed-text (via Ollama) | passage embeddings for semantic search | Apache 2.0 |

**Technologies and frameworks**

| Package | Use | Licence |
|---|---|---|
| Ollama, `ollama` (npm) | local inference runtime and its Node client | MIT |
| `@osdk/maker`, `@osdk/cli`, `@osdk/generator-converters.ontologyir` (Palantir) | the ontology as code, compiled to a typed SDK | Apache 2.0 |
| `@osdk/client`, `@osdk/api` (Palantir) | the ontology client | Apache 2.0 |
| `@osdk/faux` (Palantir) | an in-memory implementation of the Foundry Ontology HTTP contract, served locally as the ontology engine | Apache 2.0 |
| `node:sqlite` (built into Node 22) | persistence: objects, passages, embeddings, audit and inference logs | MIT |
| `zod` | validates every model output before it is stored | MIT |
| `pdfjs-dist` | PDF text extraction | Apache 2.0 |
| `papaparse` | CSV parsing | MIT |
| React, Vite, TypeScript | the application | MIT, MIT, Apache 2.0 |
| `@blueprintjs/core`, `@blueprintjs/icons` (Palantir) | UI components and icons | Apache 2.0 |
| `@xyflow/react` | graph canvas | MIT |
| Source Sans 3, D-DIN | typefaces, bundled | OFL |
| Playwright | browser smoke tests (development only) | Apache 2.0 |

**APIs and cloud services:** none. No cloud AI API is called at any point.

**Existing code and assets**

| Source | What was used | How |
|---|---|---|
| Palantir OSDK repository (Apache 2.0) | the Node-to-msw bridge pattern from `packages/vite-plugin-oac/src/routeConnectToMsw.ts` | adapted to a plain Node `http` server |
| `bilawalsidhu/gods-eye-view` (MIT) | engineering patterns consulted while planning: a source contract with a provenance envelope, a tool catalog with result caps and refusal codes | ideas re-implemented in our own code; no file copied |
| `gura105/operational-ontology` (MIT) | ideas: an audit log of every action, declared ownership per property | ideas only |
| Palantir Gotham's public service description | the names and shape of the views (Object Explorer, Graph with Search Around, Timeline) | product reference, no code |
| BARGHEST brand kit | logo, mark and favicon | the team's own, made for this project |

Everything else was written during the hackathon. The git history runs from 9 October 2026, 16:41, to the
submission on 10 October.

**AI development tools:** Claude Code (Anthropic), used throughout to write code, tests and the synthetic case files,
working from the team's plans. `CLAUDE.md` and `Session Logs/` are the working notes those sessions kept, left in on
purpose as the build diary.

## Licence

The code is the team's own; the bundled fonts carry their OFL licence in `public/fonts/OFL.txt`.
