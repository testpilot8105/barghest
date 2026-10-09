# BARGHEST - Local-AI intelligence workbench

## What this is

BARGHEST turns a folder of documents and records that disagree with each other into one connected, explorable
model of people, organisations, places, events and evidence, using a language model that runs on the user's own
machine. The pipeline: documents, local extraction, entity resolution, ontology, then graph, timeline, evidence and
questions. Local AI interprets the text; the ontology organises what it found; the workbench lets a person check it.

Built for the AppBuildersPH Hackathon 2026 (theme: local AI). Target user: an investigator or analyst in a Philippine
public office who holds records that cannot leave the building and works where the connection cannot be trusted. Two
demo investigations, both synthetic: a school incident (`school-incident`) and solid waste contracts across three
LGUs (`solid-waste`). Never letters: investigations are store records with a fixed id and a name the analyst can
change, and an analyst creates new ones from blocks of things to look for. Every name, account, number and report in
the data is invented.

Started with `assembly new site barghest` from the line's site starter on 09.10.2026. The app lifts out of this line
as a copy into its own public repository before the deadline, so nothing here depends on a workspace package.

Palette: own (owner, 09.10.2026): replicate Gotham's UI, Blueprint, dark mode, D-DIN for headings, Source Sans 3 for body

Blueprint v6 dark theme (`bp6-dark` on the root) and Blueprint's own palette variables. The only custom colours are the
three timeline classes (observed, system, analyst), from Blueprint's palette too. D-DIN for headings through
`@font-face` on the bundled woff2 files in `public/fonts/` (OFL, licence file beside them); Source Sans 3 for body
through Blueprint's `--bp-typography-family-default`. No other face, no generic font stack. Brand kit mark and
lockup in `public/`, favicon set in `public/favicon/`.

## Ports and processes

| Port | What runs there |
|---|---|
| 5180 | Vite, the app. `/api` and `/barghest` are proxied to the engine, so the browser talks to one origin |
| 8787 | The engine: `engine/server.mjs`, Palantir's `@osdk/faux` served over plain Node `http`, persisted in `data/barghest.sqlite` through `node:sqlite`, plus the `/barghest/*` routes |
| 11434 | Ollama, the local model runtime. The engine is its only caller |

`pnpm dev` starts the app and the engine together (`scripts/dev.mjs`). `pnpm dev:app` and `pnpm dev:engine` start
one each. Node 22.18 or newer (`node:sqlite`, native TypeScript imports in the engine).

## Local LLM rule

On demand, never resident (owner, 09.10.2026, after the P2 probe and the pipeline proof measured about 2 GB while
loaded). Ollama runs as a Homebrew service (`brew services start ollama`) and idles with nothing loaded; the engine
loads `qwen3:4b-instruct` or `nomic-embed-text` on the first call and Ollama unloads them again after 2 minutes idle
(`KEEP_ALIVE` in `engine/llm.mjs`). Never pin a model in memory, never raise the keep-alive, never pull another model
without asking. `BARGHEST_OLLAMA=off` keeps an engine away from port 11434 entirely; the model-free proofs run that
way. Extraction costs about 60 seconds per passage on this Mac, so document packs are imported well ahead of a demo.

## Layout

| Piece | What it is | Owner |
|---|---|---|
| `ontology/ontology.mts` | The ontology as code (`@osdk/maker`): core types, both scenario packs, links, actions | plumbing |
| `ontology/ownership.ts` | Per type and property: `source`, `ontology` or `derived`. The catalog shows it; actions refuse writes to `source` fields | plumbing |
| `ontology/build.mjs` | The three-command build: maker to IR, IR to `ontology.json`, `ontology.json` to the typed SDK in `sdk/` | plumbing |
| `sdk/` | The generated SDK. Never edited by hand; `pnpm ontology:build` regenerates it | plumbing |
| `engine/` | Server, persistence, ingest, extract, resolve, queries, ask, the dev seed, the proofs | plumbing |
| `src/data/` | The Object Explorer data layer: plain functions and React hooks over the ontology. The only path the screens import; nothing from `@osdk` reaches them | plumbing |
| `docs/engine-api.md` | The contract between the engine and the screens, with a changelog at the foot | plumbing |
| `src/` outside `src/data/`, `public/`, `index.html`, `scripts/smoke-barghest.mjs` | The screens, in Gotham's shapes: Object Explorer, Entity Profile, Evidence Explorer, Graph, Timeline, Assistant | shell |
| `data/school-incident/`, `data/solid-waste/` | The synthetic document packs, with `ANSWERS.md` listing the planted links | case files |
| `engine/extract/snapshots/` | The two demo templates' extraction schema and prompt, byte for byte; `proof:investigations` fails if they drift | plumbing |
| `data/barghest.sqlite` | The store: objects, passages, embeddings, audit log, inference log. Ignored by git; delete it to re-import from empty | runtime |

Every control is a Blueprint component imported straight from `@blueprintjs/*`; icons from `@blueprintjs/icons`
only; no native `select`, no native `title=`; body text 14px or larger. `@xyflow/react` draws the graph.

## Dev flow

Double-click `launch-barghest (Mac).command` (Windows: the `.cmd` next to it, Linux: the `.sh`): it runs on
`localhost:5180` and every save shows up live. From the line root: `pnpm --filter @atlas/barghest dev`. Build:
`pnpm --filter @atlas/barghest build`. Branch `barghest`, shared by three sessions; commits by path, never a push of
the line.

## Testing

| Command | What it proves |
|---|---|
| `pnpm --filter @atlas/barghest smoke` | the built app paints its first screen in a real browser with zero console errors |
| `pnpm --filter @atlas/barghest proof:p1` | a Person created through `@osdk/client` over HTTP survives an engine restart |
| `pnpm --filter @atlas/barghest proof:explorer` | the Object Explorer data layer's checks against the running engine (`--real` on extracted data) |

## Session Log Convention

`Session Logs/DD.MM.YYYY.md`, one heading per session (Plumbing, Shell, Case files), Session Summary at the bottom,
rolling failed-attempts list never cleared. No machine paths: this folder goes public.
