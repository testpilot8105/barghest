All synthetic. Every LGU, barangay, company, person, plate and number in this pack is invented.

# BARGHEST: solid waste across three LGUs

Eleven files shaped like the registers they imitate, for a local model to read one passage at a time. The province of Salimbayan, its three LGUs, the barangays, the haulers, the officials, the agencies (the Maharlika Environmental Agency, the Office of the State Auditor, the State Procurement Portal, the 311 hotline), the Solid Waste Act and the contract, permit, ticket and plate numbers are all made up. An OSA Audit Observation Memorandum asks management to comment and is not a finding of fraud; an MEA Notice of Violation is a notice, and nobody here is accused of a crime.

## Files, in `sources/`

- `swm-plan-saneladio.pdf`, `swm-plan-tumanaw.pdf`, `swm-plan-dalumat.pdf`: extracts of three ten-year Solid Waste Management Plans (Solid Waste Act). The LGU, its barangays, its materials recovery facilities, where residual waste goes, the hauler it names (spelled differently in each), the diversion target.
- `hauling-contracts.pdf`: three contract excerpts on one page, the file imported live. One hauler under three spellings, contract numbers, amounts, four trucks each.
- `spp-awards.csv`: State Procurement Portal (SPP) award notices, five rows. Contract numbers, amounts, award dates, bidder names in capitals, a certificate reference and a Tax ID.
- `mrf-quarterly-reports.csv`: consolidated barangay MRF reports for 2025, six rows. Two barangays have no report for the third quarter.
- `complaints-311.csv`: 311 complaint records, sixteen rows. Most uncollected-waste complaints fall in the two barangays with the missing reports.
- `truck-trip-logs.csv`: gate and transfer-station logs, eighteen rows, February 2026. The same plates logged in two LGUs on the same days at overlapping times.
- `mea-inspection-letters.txt`: two MEA letters. A landfill found compliant with findings, and a Notice of Violation for an open dumpsite that names the hauler's trucks.
- `osa-audit-observations.pdf`: OSA Audit Observation Memorandum, two pages. Two contracts that list the same four trucks, with their amounts.
- `mea-landfill-permit.txt`: Environmental Compliance Certificate for the sanitary landfill. Number, operator, capacity, expiry.

## Size and import time

24 passages in all, about 24 minutes of extraction at roughly a minute per passage. `hauling-contracts.pdf` is one passage. PDFs are A4 in Arial with a footer line on every page; text files carry the marker line first.

## Answers

`ANSWERS.md` lists the planted links in plain English and `key.json` holds the same facts for a machine. The landfill document is its Environmental Compliance Certificate.
