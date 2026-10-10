# BARGHEST: what it cannot do yet

Written 09.10.2026 from the code, the engine contract (`engine-api.md`), the Session Logs and the measured runs, and checked again on 10.10.2026 before submission. Every limit below is true of the submitted code.

## 1. Speed and memory

| Limit | What it means | Could be lifted by |
|---|---|---|
| About 60 seconds of model time per passage (about 1,200 characters), measured on an M4 with 16 GB | A dense A4 page is 2 to 3 passages, so roughly 2 to 3 minutes a page (estimate). A 20-page report is close to an hour | A faster machine, or a smaller model that is worse at the job. Nothing to fix in the code |
| Passages are read one at a time | Two files importing at once queue behind each other | Running calls in parallel needs more memory than this Mac has spare |
| Both demo packs: 49 passages, about 49 minutes | The packs are imported before the demo, never on stage | |
| The live file on stage is one passage, about 60 seconds | Demo step 2 has a 45 second slot, so it runs slightly over | Talk over it, or import just before going on and show the log |
| An answer from the Assistant takes about 17 seconds | Fine for a demo, slow for a conversation | |
| About 2 GB of memory while the model is loaded | It unloads 2 minutes after the last call, by design | |

## 2. Files it can read

| Limit | What it means | Could be lifted by |
|---|---|---|
| The model reads PDF, CSV, TXT, JSON and MD only | Photos are stored, their metadata read and linked to objects, but the model never reads them. Word, Excel, email, audio and video are refused | Readers for Word and Excel are small but add a library each (not in this version) |
| PDFs must contain real text; no OCR | A scanned PDF or a photo of a page gives nothing. The screen says "no text" instead of failing silently | OCR is a big addition; not for the hackathon |
| JSON: only lists of records are read | A field at the top of a JSON file that isn't a list is dropped | |
| CSV: a row's date is read only from a column with one of these exact names: date, datetime, timestamp, observed_at, filed_at, created_at, time, when, reported_at, inspected_at, awarded_at, award_date | A CSV with "Date of Incident" as its header puts nothing on the timeline | A column-mapping step at import |
| Tested only on the two synthetic packs, mostly English with some Filipino | Accuracy on other languages and on real records is unmeasured | |

## 3. How it reads

| Limit | What it means |
|---|---|
| The model sees one passage at a time, never the whole file | A link split across two passages (a name on one page, the gun's serial on the next) is not found |
| It's a 4B model (`qwen3:4b-instruct`) | It misses things and occasionally misreads. Every link carries a confidence; anything under 0.9 is marked for review, and every link opens to the passage it came from so a person can check |
| The Assistant does one retrieval and one answer, no back-and-forth reasoning | It answers from what it found or refuses. It doesn't chase follow-up questions on its own |
| Semantic search needs an embedding step after import | Until it runs, search falls back to keywords |

## 4. Matching the same person or thing across files

Found while building the two packs (Session Logs, 09.10.2026):

| Limit | What it means |
|---|---|
| Two mentions with the same one-word surname and different initials score 0.9 and merge automatically; bare surnames score 0.97 | Two different "Dela Peña"s written only as surname and initials can be merged wrongly |
| "Wacky" (a nickname) can't be matched to the handle `wckyy_09` by the rules | The packs tie each account to its person in a sentence; real data may not |
| "V" after a name is read as a suffix, like Jr. | "Marco V." loses the V |
| "Municipality of Tumanaw" against plain "Tumanaw" scores 0.7 | It goes to the model to decide instead of matching by rule |

## 5. Investigations and folders

| Limit | What it means |
|---|---|
| A new investigation picks from fixed blocks of things to look for (people, organisations, places, events, firearms, haulers and so on) | It can't invent a new kind of thing with its own fields. Anything outside the blocks lands in "Other thing" with the model's own label (General template) |
| No new object types from inside the app | Foundry's Ontology Manager is a later product |
| The two demo investigations look for exactly what they look for today | So the packs behave as tested |
| Moving a file to another investigation means the model reads it again there | About a minute per passage, and the model must be on |
| Templates are fixed: School incident, Solid waste and General | Saving your own template comes later |
| A rename never changes the address bar | Old links keep working; the screen always shows the new name |
| Objects the model found (people, places) can't be renamed in these notes | That's S2 Browser editing, planned with S2 |
| A file lives in one folder | Like Compass: move it, don't copy it |
| A folder is deleted only when empty | Nothing is lost by accident |
| Opening a file shows the text the model read, passage by passage; the real file opens in a new tab | No highlights drawn on the rendered PDF page |

## 6. People and machines

| Limit | What it means |
|---|---|
| One analyst on one machine | No logins, no users, no permissions, no sharing. The audit log records every change as "analyst" |
| No sync between machines | Each copy has its own database |
| Needs Ollama installed and the two models downloaded once | After that it's built to run with Wi-Fi off |

## 7. The demo data

- Both packs are synthetic. Every person, school, LGU, company, account and number is invented, and each name was
  web-searched against real ones. A few names are shared with real places by coincidence (the school name matches
  several real schools, as the cast specified).
- Nothing has been tested on real case files.

