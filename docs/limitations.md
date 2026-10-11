# What BARGHEST cannot do yet

An honest list, written from the code and from measured runs on an Apple M4 with 16 GB. Every limit below is true of the current code.

## 1. Speed and memory

| Limit | What it means | Could be lifted by |
|---|---|---|
| About 60 seconds of model time per passage (about 1,200 characters) | A dense A4 page is 2 to 3 passages, so roughly 2 to 3 minutes a page. A 20-page report is close to an hour | A faster machine, or a smaller model that is worse at the job |
| Passages are read one at a time | Two files importing at once queue behind each other | Running calls in parallel needs more memory than a 16 GB laptop has spare |
| An answer from the Assistant takes 20 to 45 seconds | Fine for a question now and then, slow for a conversation | |
| About 2 GB of memory while the model is loaded | It unloads 2 minutes after the last call, by design | |

## 2. Files it can read

| Limit | What it means | Could be lifted by |
|---|---|---|
| The model reads PDF, CSV, TXT, JSON and MD only | Photos are stored, their metadata read and linked to objects, but the model never reads them. Word, Excel, email, audio and video are refused | Readers for Word and Excel are small but add a library each |
| PDFs must contain real text; no OCR | A scanned PDF or a photo of a page gives nothing. The screen says "no text" instead of failing silently | OCR, a large addition |
| JSON: only lists of records are read | A field at the top of a JSON file that is not a list is dropped | |
| CSV: a row's date is read only from a column with one of these exact names: date, datetime, timestamp, observed_at, filed_at, created_at, time, when, reported_at, inspected_at, awarded_at, award_date | A CSV with "Date of Incident" as its header puts nothing on the timeline | A column-mapping step at import |
| Tested only on the two synthetic packs, mostly English with some Filipino | Accuracy on other languages and on real records is unmeasured | |

## 3. How it reads

| Limit | What it means |
|---|---|
| The model sees one passage at a time, never the whole file | A link split across two passages (a name on one page, the gun's serial on the next) is not found |
| It is a 4B model (`qwen3:4b-instruct`) | It misses things and occasionally misreads. On the two packs it found 35 of 70 planted links exactly and 13 more as a different kind of link; 22 it missed. Every link carries a confidence; anything under 0.9 is marked for review, and every link opens to the passage it came from so a person can check |
| The model sometimes writes its reasoning into a field | A "storage" property on a firearm reading "not specified in passage (unknown or missing data...)" is the model explaining itself where a value should be. The ownership tag still says the value came from a source passage, so it is easy to spot |
| The Assistant does one retrieval and one answer, no back-and-forth reasoning | It answers from what it found or refuses. It does not chase follow-up questions on its own |
| Semantic search needs an embedding step after import | Until it runs, search falls back to keywords |

## 4. Matching the same person or thing across files

| Limit | What it means |
|---|---|
| A model "same" verdict joins two clusters, and one wrong verdict joins a family | In the school pack the model called a father and son "the same" on one pair, and an aunt and nephew on another, so three Dela Peñas ended up as one Person. A rule that two people with different first names never merge is the fix, not yet written |
| Two mentions with the same one-word surname and different initials score 0.9 and merge automatically; bare surnames score 0.97 | Two different "Dela Peña"s written only as surname and initials can be merged wrongly |
| A nickname cannot be matched to a handle by the rules | "Wacky" and `wckyy_09` are joined only if a sentence in the files ties them together |
| "V" after a name is read as a suffix, like Jr. | "Marco V." loses the V |
| A place written with and without its prefix scores 0.7 | "Municipality of Tumanaw" against plain "Tumanaw" goes to the model to decide instead of matching by rule |

## 5. Investigations and folders

| Limit | What it means |
|---|---|
| A new investigation picks from fixed blocks of things to look for (people, organisations, places, events, firearms, haulers and so on) | It cannot invent a new kind of thing with its own fields. Anything outside the blocks lands in "Other thing" with the model's own label |
| No new object types from inside the app | The ontology is code; changing it means editing `ontology/ontology.mts` and rebuilding |
| Templates are fixed: School incident, Solid waste and General | Saving your own template comes later |
| Moving a file to another investigation means the model reads it again there | About a minute per passage, and the model must be on |
| A rename never changes the address bar | Old links keep working; the screen always shows the new name |
| A file lives in one folder | Move it, do not copy it |
| A folder is deleted only when empty | Nothing is lost by accident |
| Opening a file shows the text the model read, passage by passage; the real file opens in a new tab | No highlights drawn on the rendered PDF page |

## 6. People and machines

| Limit | What it means |
|---|---|
| One analyst on one machine | No logins, no users, no permissions, no sharing. The audit log records every change as "analyst" |
| No sync between machines | Each copy has its own database |
| Needs Ollama installed and the two models downloaded once | After that it runs with Wi-Fi off |

## 7. The data

- Both packs are synthetic. Every person, school, LGU, company, account and number is invented, and each name was checked against real ones. A few names are shared with real places by coincidence.
- Nothing has been tested on real case files.
