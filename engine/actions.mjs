// The action implementations faux runs. Three actions, from maker's helpers: create a Person (the analyst adds one
// by hand, and the P1 proof uses it), create a Resolution (which also points the candidates at their canonical
// object), and review a Relationship (status and note only). Ownership is enforced by what each one is willing to
// write: no action here touches a source-backed field.
import { toServerObject } from './faux.mjs';

const pkOf = (v) => (v && typeof v === 'object' ? (v.$primaryKey ?? v.__primaryKey ?? v.primaryKey) : v);

export function createActionImpls(meta) {
  return {
    createObjectPerson: (batch, payload) => {
      const p = payload.parameters;
      const obj = toServerObject(meta, 'Person', { ...p, scenario: p.scenario ?? 'manual' });
      batch.addObject('Person', obj.__primaryKey, obj);
    },

    // candidateIds are "Type:pk". A candidate of the canonical type gets canonicalId; a DigitalAccount resolved to
    // a Person gets its owner. The originals are never deleted or merged away.
    createObjectResolution: (batch, payload) => {
      const p = payload.parameters;
      const obj = toServerObject(meta, 'Resolution', { ...p, decidedAt: p.decidedAt ?? new Date().toISOString() });
      batch.addObject('Resolution', obj.__primaryKey, obj);
      if (p.decision !== 'same') return;
      for (const ref of p.candidateIds ?? []) {
        const [type, pk] = String(ref).split(':');
        if (!type || pk == null) continue;
        if (type === p.canonicalType && pk !== p.canonicalId) {
          batch.modifyObject(type, pk, { canonicalId: p.canonicalId });
        } else if (type === 'DigitalAccount' && p.canonicalType === 'Person') {
          batch.modifyObject(type, pk, { personId: p.canonicalId });
        }
      }
    },

    modifyObjectRelationship: (batch, payload) => {
      const p = payload.parameters;
      const pk = pkOf(p.objectToModifyParameter);
      const update = {};
      if (p.status != null) update.status = p.status;
      if (p.reviewNote != null) update.reviewNote = p.reviewNote;
      batch.modifyObject('Relationship', pk, update);
    },
  };
}
