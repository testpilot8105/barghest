// The ontology runtime: Palantir's @osdk/faux (the Foundry Ontology v2 HTTP contract, in memory) fed from
// ontology/ontology.json, with every action wrapped so it writes the audit log and persists what it touched.
// Links are derived by faux from the foreign-key properties, so a reload is "register every row".
import { randomUUID } from 'node:crypto';
import { FauxFoundry } from '@osdk/faux';

export const camelize = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

/** Build a server object in faux's shape from plain properties. Title and rid come from the type's metadata. */
export function toServerObject(meta, type, props) {
  const def = meta.objectTypes[type];
  if (!def) throw new Error(`unknown object type ${type}`);
  const pk = props[def.objectType.primaryKey];
  if (pk == null) throw new Error(`${type} needs its primary key ${def.objectType.primaryKey}`);
  const title = props[def.objectType.titleProperty];
  const clean = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined && v !== null));
  return {
    ...clean,
    __apiName: type,
    __primaryKey: pk,
    __title: title == null ? String(pk) : String(title),
    __rid: props.__rid ?? `ri.phonograph2-objects.main.object.${randomUUID()}`,
  };
}

export function createEngine({ meta, store, baseUrl, actionImpls, actor = 'analyst' }) {
  const foundry = new FauxFoundry(baseUrl, meta.ontology);
  const ontology = foundry.getDefaultOntology();
  for (const def of Object.values(meta.objectTypes)) ontology.registerObjectType(def);
  for (const def of Object.values(meta.interfaceTypes ?? {})) ontology.registerInterfaceType(def);
  for (const def of Object.values(meta.sharedPropertyTypes ?? {})) ontology.registerSharedPropertyType(def);
  const data = foundry.getDefaultDataStore();

  /** After an action ran: persist every object it added or changed, drop the ones it deleted, then audit it. */
  function persistEdits(edits) {
    const touched = [];
    const changed = [];
    for (const edit of edits) {
      if (edit.type === 'addObject' || edit.type === 'modifyObject') {
        const obj = data.getObject(edit.objectType, edit.primaryKey);
        if (obj) changed.push(obj);
        touched.push(`${edit.objectType}:${edit.primaryKey}`);
      } else if (edit.type === 'deleteObject') {
        store.remove(edit.objectType, edit.primaryKey);
        touched.push(`${edit.objectType}:${edit.primaryKey}`);
      } else if (edit.type === 'addLink' || edit.type === 'deleteLink') {
        for (const side of [edit.aSideObject, edit.bSideObject]) {
          const obj = data.getObject(side.objectType, side.primaryKey);
          if (obj) changed.push(obj);
          touched.push(`${side.objectType}:${side.primaryKey}`);
        }
      }
    }
    if (changed.length) store.upsertMany(changed);
    return [...new Set(touched)];
  }

  // maker names actions in kebab case (create-object-person); faux looks them up camelized (createObjectPerson),
  // which is also the name the generated SDK uses. Register under the camelized name so both agree.
  for (const kebabDef of Object.values(meta.actionTypes)) {
    const def = { ...kebabDef, apiName: camelize(kebabDef.apiName) };
    const impl = actionImpls[def.apiName];
    if (!impl) {
      console.warn(`engine: no implementation for action ${def.apiName}; it will be refused`);
      continue;
    }
    ontology.registerActionType(def, (batch, payload, ctx) => {
      try {
        const result = impl(batch, payload, ctx);
        const objectIds = persistEdits(batch.objectEdits.edits);
        store.audit({ action: def.apiName, actor, outcome: 'applied', params: payload.parameters, edits: batch.objectEdits.edits, objectIds });
        return result;
      } catch (e) {
        // Whatever the batch already applied in memory is persisted too, so memory and disk never disagree.
        const objectIds = persistEdits(batch.objectEdits.edits);
        store.audit({ action: def.apiName, actor, outcome: `refused: ${e?.message ?? e}`, params: payload.parameters, edits: batch.objectEdits.edits, objectIds });
        throw e;
      }
    });
  }

  // Foreign-key property names per type: faux derives a link from each one when the object is registered.
  const foreignKeys = Object.fromEntries(
    Object.entries(meta.objectTypes).map(([type, def]) => [
      type,
      def.linkTypes.filter((l) => l.cardinality === 'ONE' && l.foreignKeyPropertyApiName).map((l) => l.foreignKeyPropertyApiName),
    ]),
  );

  /** Register objects into memory in two passes: first without foreign keys, then with them, so every link target
   * exists when its link is derived, whatever order the rows come in. */
  function register(objs) {
    for (const obj of objs) {
      if (data.getObject(obj.__apiName, obj.__primaryKey)) continue;
      const bare = { ...obj };
      for (const fk of foreignKeys[obj.__apiName] ?? []) delete bare[fk];
      data.registerObject(bare);
    }
    for (const obj of objs) data.replaceObjectOrThrow(obj);
  }

  /** Load the rows the store holds. */
  function load() {
    const rows = store.all();
    register(rows);
    return rows.length;
  }

  /** Write objects that bypass actions (ingest, resolve, seed): store first, then memory. */
  function put(objs) {
    store.upsertMany(objs);
    register(objs);
  }

  /** Remove one object from memory and the store. faux derives links from foreign keys and only drops them when the
   * object is replaced without them, so the keys go first; otherwise a pivot on the far side keeps naming the ghost. */
  function remove(type, pk) {
    const obj = data.getObject(type, pk);
    if (obj) {
      const bare = { ...obj };
      for (const fk of foreignKeys[type] ?? []) delete bare[fk];
      data.replaceObjectOrThrow(bare);
      data.unregisterObjectOrThrow(type, pk);
    }
    store.remove(type, pk);
  }

  return { foundry, ontology, data, handlers: foundry.handlers, load, put, remove };
}
