All synthetic. Every LGU, barangay, company, person, plate and number in this pack is invented.

# BARGHEST Scenario B: solid waste across three LGUs

Eleven files shaped like the Philippine registers they imitate, for a local model to read one passage at a time. The province of Salimbayan, its three LGUs, the barangays, the haulers, the officials, the contract, permit, ticket and plate numbers are all made up. Real agencies (DENR, EMB, COA, PhilGEPS, the 8888 hotline) and RA 9003 are named because the register is the point. A COA Audit Observation Memorandum asks management to comment and is not a finding of fraud; an EMB Notice of Violation is a notice, and nobody here is accused of a crime.

## Files, in `sources/`

- `swm-plan-saneladio.pdf`, `swm-plan-tumanaw.pdf`, `swm-plan-dalumat.pdf`: extracts of three ten-year Solid Waste Management Plans (RA 9003). The LGU, its barangays, its materials recovery facilities, where residual waste goes, the hauler it names (spelled differently in each), the diversion target.
- `hauling-contracts.pdf`: three contract excerpts on one page, the file imported live. One hauler under three spellings, contract numbers, amounts, four trucks each.
- `philgeps-awards.csv`: PhilGEPS award notices, five rows. Contract numbers, amounts, award dates, bidder names in capitals, a certificate reference and a TIN.
- `mrf-quarterly-reports.csv`: consolidated barangay MRF reports for 2025, six rows. Two barangays have no report for the third quarter.
- `complaints-8888.csv`: 8888 complaint records, sixteen rows. Most uncollected-waste complaints fall in the two barangays with the missing reports.
- `truck-trip-logs.csv`: gate and transfer-station logs, eighteen rows, February 2026. The same plates logged in two LGUs on the same days at overlapping times.
- `emb-inspection-letters.txt`: two EMB letters. A landfill found compliant with findings, and a Notice of Violation for an open dumpsite that names the hauler's trucks.
- `coa-audit-observations.pdf`: COA Audit Observation Memorandum, two pages. Two contracts that list the same four trucks, with their amounts.
- `denr-landfill-permit.txt`: Environmental Compliance Certificate for the sanitary landfill. Number, operator, capacity, expiry.

## Size and import time

24 passages in all, about 24 minutes of extraction at roughly a minute per passage. `hauling-contracts.pdf` is one passage. PDFs are A4 in Arial with a footer line on every page; text files carry the marker line first.

## Answers

`ANSWERS.md` lists the planted links in plain English and `key.json` holds the same facts for a machine. Both say where this pack differs from the handoff on purpose. A landfill-specific "Permit to Operate" could not be confirmed, so the landfill document is the Environmental Compliance Certificate.
