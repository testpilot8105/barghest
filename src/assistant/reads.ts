// The two reads the Assistant makes besides asking: each cited passage's label and file, so a citation names its
// source and opens Files at it, and the example questions with a name taken from the data.
import { fetchRows, histogram, useAsync, type AsyncState, type DataClient, type Step } from '../data/index.ts';

export interface CitedPassage {
  /** The passage's own label, the file and its number: "irf-blotter.txt #2". */
  label: string;
  documentId: string;
}

async function citedPassages(dc: DataClient, ids: string[]): Promise<Map<string, CitedPassage>> {
  if (!ids.length) return new Map();
  const page = await fetchRows(dc, { start: 'Passage', steps: [{ filter: { property: 'passageId', op: 'in', value: ids } }], pageSize: ids.length });
  return new Map(page.rows.map((r) => [r.pk, { label: String(r.properties.label ?? r.title), documentId: String(r.properties.documentId ?? '') }]));
}

export function useCitedPassages(ids: string[]): AsyncState<Map<string, CitedPassage>> {
  return useAsync((dc) => citedPassages(dc, ids), ids.join('|'));
}

// Example questions per investigation template; the owner approved the wording (09.10.2026). `{person}` is filled
// from the data, never written here.
const EXAMPLES: Record<string, string[]> = {
  'school-incident': ['What connects {person} to the incident?', 'Who owns the firearm recovered at the scene?', 'Which accounts belong to {person}?'],
  'solid-waste': ['Which hauler serves more than one LGU and what did the inspections say?', 'What did the inspections find at the dumpsite?', 'Who signed the hauling contracts?'],
  general: ['What do the files say about {person}?'],
};

/** The investigation's central person: the most source spellings merged into one, else the most links out. */
async function centralPerson(dc: DataClient, investigation: string): Promise<string | null> {
  const scope: Step = { filter: { property: 'scenario', op: 'eq', value: investigation } };
  const tries: [string, Step[], string][] = [
    ['Person', [scope], 'canonicalId'],
    ['Relationship', [scope, { filter: { property: 'fromType', op: 'eq', value: 'Person' } }], 'fromId'],
  ];
  for (const [start, steps, property] of tries) {
    const h = await histogram(dc, { start, steps }, property).catch(() => null);
    const top = h?.buckets.find((b) => b.bucket && b.bucket !== '(empty)' && b.count > 0);
    if (!top) continue;
    const page = await fetchRows(dc, { start: 'Person', steps: [{ filter: { property: 'personId', op: 'eq', value: top.bucket } }], pageSize: 1 });
    if (page.rows[0]) return page.rows[0].title;
  }
  return null;
}

async function examples(dc: DataClient, investigation: string, template: string | null): Promise<string[]> {
  const wording = EXAMPLES[template ?? 'general'] ?? EXAMPLES.general;
  const needsPerson = wording.some((q) => q.includes('{person}'));
  const person = needsPerson ? await centralPerson(dc, investigation) : null;
  return wording.flatMap((q) => (!q.includes('{person}') ? [q] : person ? [q.replaceAll('{person}', person)] : []));
}

export function useExamples(investigation: string, template: string | null): AsyncState<string[]> {
  return useAsync((dc) => examples(dc, investigation, template), `${investigation}|${template ?? ''}`);
}
