// The passages behind a piece of evidence, each with the file it sits in. Until plumbing's usePassages lands this is
// two exploration reads: the Passages by key, then their Documents by key. Swap the body for usePassages then; the
// shape the drawer and the profile read stays the same.
import { fetchRows, useAsync, type AsyncState, type DataClient, type Row } from '../data/index.ts';

export interface EvidencePassage {
  pk: string;
  /** Zero-based place in its file. */
  index: number | null;
  label: string;
  text: string;
  documentId: string;
  /** The file's name, or its id while the Document can't be read. */
  fileName: string;
  /** The register the file came from (the Document's `system`). */
  register: string;
  /** The investigation the file belongs to, for the Files link. */
  investigation: string;
}

async function byKey(dc: DataClient, type: string, key: string, ids: string[]): Promise<Map<string, Row>> {
  if (!ids.length) return new Map();
  const page = await fetchRows(dc, { start: type, steps: [{ filter: { property: key, op: 'in', value: ids } }], pageSize: ids.length });
  return new Map(page.rows.map((r) => [r.pk, r]));
}

const text = (v: unknown) => (v == null ? '' : String(v));

/** The passages in the order asked for. An id the store no longer holds is left out. */
export async function loadPassages(dc: DataClient, ids: string[]): Promise<EvidencePassage[]> {
  const wanted = [...new Set(ids.filter(Boolean))];
  const passages = await byKey(dc, 'Passage', 'passageId', wanted);
  const docIds = [...new Set([...passages.values()].map((p) => text(p.properties.documentId)).filter(Boolean))];
  const docs = await byKey(dc, 'Document', 'documentId', docIds);
  return wanted.flatMap((id) => {
    const p = passages.get(id);
    if (!p) return [];
    const documentId = text(p.properties.documentId);
    const doc = docs.get(documentId);
    const index = p.properties.index;
    return [
      {
        pk: p.pk,
        index: typeof index === 'number' ? index : null,
        label: text(p.properties.label) || p.pk,
        text: text(p.properties.text),
        documentId,
        fileName: doc ? doc.title : documentId,
        register: doc ? text(doc.properties.system) : '',
        investigation: text(doc?.properties.scenario ?? p.properties.scenario),
      },
    ];
  });
}

export function usePassageFiles(ids: string[]): AsyncState<EvidencePassage[]> {
  return useAsync((dc) => loadPassages(dc, ids), ids.join('|'));
}
