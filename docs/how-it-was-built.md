# How BARGHEST was built

Two days, 9 to 10 October 2026, one person directing Claude Code sessions working in parallel. This page keeps the
context that matters from the working notes those sessions left: the order things were built in, the measured
results, and what went wrong on the way.

## The order

| Step | What was built |
|---|---|
| Scaffold | Vite + React + Blueprint app, the ontology as code with `@osdk/maker`, Palantir's `@osdk/faux` serving it over HTTP with SQLite behind it, the Object Explorer data layer, a first ingest and resolution pass |
| The model side | Ollama behind one door (`engine/llm.mjs`): every call carries a JSON schema, runs at temperature 0, and is logged with model, prompt hash, latency and tokens. The model loads on the first call and unloads two minutes after the last |
| The case files | Two synthetic document packs, each with an answer sheet of planted links. Every name was checked against real companies, schools and people; hauler names in particular kept colliding with real firms until a rare surname was chosen |
| The file manager | Investigations as store records, folders, rename, move, delete, the stored original kept and served, photos as files with their metadata read and linked |
| The screens | Files and Data Sources, the Profile and evidence drawer, Graph and Timeline as saved files, the Assistant with citations and "How this was answered" |
| The real packs | Both packs imported through the full pipeline with the model on, and the result scored against the answer sheets |

## What the AI tools did

Claude Code wrote the code, the checks and the synthetic case files, working from plans and reviews by the owner.
Each session kept a log with what shipped, what it tried that failed, and gotchas for the next session. The
pattern that held up: one session per area (engine, screens, case files) with disjoint files, a contract document
(`engine-api.md`) between the engine and the screens, and a proof script per feature that starts its own throwaway
engine and removes everything it made.

## Measured

| What | Result |
|---|---|
| Extraction | About 60 seconds per passage of about 1,200 characters on an Apple M4 with 16 GB |
| School incident | 13 files, 24 passages, 33 minutes. 34 planted links: 15 found, 11 found as another kind (8 of them "owns" landing as the account's owner property, which is the right link), 8 missed |
| Solid waste | 10 files, 23 passages, 37 minutes. 36 planted links: 20 found, 2 as another kind, 14 missed: all five contract awards (contracts carry their LGU but no hauler), the six trip-log sightings, one dumpsite sighting and both inspections (no object for the environment bureau) |
| Resolution | The three Dela Peñas in the school pack merged into one Person because the model answered "same" on a father-and-son pair and an aunt-and-nephew pair. The two Villarins, Mabansag and Mabansay, and the two Salvadors stayed apart |
| The subject | Four of his five name spellings landed on one Person, the nickname on none; his four accounts resolved to separate records named after the handles |

## What went wrong, and what it taught

- The first ontology build had every link reversed. In maker's `defineLink`, each side's metadata names the link
  that lives on that object.
- The OSDK client refuses two operators under one property, so range filters send one clause per bound inside `$and`.
- pdfjs's legacy build has no `destroy` in Node; use `cleanup`.
- An initial was matching a word both names already shared ("D." against "Dela"), scoring two different people at
  0.8. Initials now count only for a word the other name has and this one lacks.
- The shortest path from the subject to the incident ran through the school, not the firearm, so a single shortest
  path hid the firearm chain. The graph now returns up to five shortest paths.
- A guidance sheet longer than one passage split its subject, his nickname and the mediation across two passages, and
  the link between them was lost. The model sees one passage at a time.
- Type words in a question (incident, hauler, inspection) were being dropped as stop words, so the Assistant's search
  found trip-log rows instead of the plan that answered the question. They are kept now, matched by stem.
- Resolution rebuilt a merged record and dropped the photo linked to it. Fixed before the real packs ran.
- A content audit of the packs found that fourteen deleted chat messages had been attributed to a suspect who was
  already in custody. Synthetic data needs the same review as real data.
