// What the photo pieces read, each with a way to read again after a link changes. A link, an unlink or a new picture
// bumps one shared version, so every piece showing photos (a profile's header and its Photos card, a photo's Shows)
// reads again together. The engine's own reads underneath (engine-api.md 2.11); nothing here talks to the model.
import { useSyncExternalStore } from 'react';
import { fetchRows, fileUrl, getObjectView, linkImage, setPhoto, unlinkImage, useAsync, type DataClient } from '../data/index.ts';

let version = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Bumped after every change to a photo's links, so every piece reads again. */
export function usePhotoVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

function photosChanged() {
  version++;
  for (const l of listeners) l();
}

/** "Type:pk" in, the two halves out. */
export function splitKey(key: string): { type: string; pk: string } {
  const at = key.indexOf(':');
  return { type: key.slice(0, at), pk: key.slice(at + 1) };
}

export interface LinkedPhoto {
  documentId: string;
  name: string;
  takenAt: string | null;
  url: string;
}

export interface ObjectPhotos {
  /** The object's picture: the photo its header and graph node show. */
  photo: { documentId: string; url: string } | null;
  /** Every photo linked to it, newest taken first. */
  images: LinkedPhoto[];
}

/** One object's picture and linked photos, read again whenever a photo's links change. */
export function useObjectPhotos(objectKey: string | null) {
  const v = usePhotoVersion();
  return useAsync<ObjectPhotos>(async (dc) => {
    if (!objectKey) return { photo: null, images: [] };
    const { type, pk } = splitKey(objectKey);
    const view = await getObjectView(dc, type, pk);
    return { photo: view.photo, images: (view.images ?? []).map((i) => ({ ...i, url: fileUrl(dc, i.documentId) })) };
  }, `photos:${objectKey ?? ''}:${v}`);
}

/** The types a photo can show: every entity type carries `photoId` (2.11). */
export function linkableTypes(dc: DataClient): string[] {
  return dc.catalog.order.filter((t) => dc.catalog.types[t].properties.some((p) => p.apiName === 'photoId'));
}

export interface ObjectHit {
  type: string;
  pk: string;
  title: string;
  photoUrl?: string;
}

/** This investigation's objects whose title holds the text, a few of each type, the resolved ones only. */
export async function searchObjects(dc: DataClient, investigation: string, text: string, perType = 4): Promise<ObjectHit[]> {
  const q = text.trim();
  if (!q) return [];
  const lists = await Promise.all(
    linkableTypes(dc).map(async (type) => {
      const def = dc.catalog.types[type];
      try {
        const page = await fetchRows(dc, {
          start: type,
          steps: [
            { filter: { property: def.titleProperty, op: 'contains', value: q } },
            { filter: { property: 'scenario', op: 'eq', value: investigation } },
          ],
          pageSize: perType * 2,
        });
        return page.rows
          .filter((r) => !r.properties.canonicalId)
          .slice(0, perType)
          .map((r) => ({ type, pk: r.pk, title: r.title, photoUrl: r.photoUrl }));
      } catch {
        return [];
      }
    }),
  );
  return lists.flat();
}

/** The pictures of the objects a photo shows, by "Type:pk": which of them use this photo as theirs. */
export function useObjectPictures(objects: Array<{ type: string; pk: string }>) {
  const v = usePhotoVersion();
  const key = objects.map((o) => `${o.type}:${o.pk}`).join('|');
  return useAsync<Map<string, string | null>>(async (dc) => {
    const out = new Map<string, string | null>();
    await Promise.all(
      objects.map(async (o) => {
        const def = dc.catalog.types[o.type];
        if (!def) return;
        const page = await fetchRows(dc, { start: o.type, steps: [{ filter: { property: def.primaryKey, op: 'eq', value: o.pk } }], pageSize: 1 }).catch(() => null);
        const photoId = page?.rows[0]?.properties.photoId;
        out.set(`${o.type}:${o.pk}`, photoId ? String(photoId) : null);
      }),
    );
    return out;
  }, `pictures:${key}:${v}`);
}

/** This investigation's photos, newest imported first: the files whose status is `photo`. */
export function useInvestigationPhotos(investigation: string, enabled: boolean) {
  const v = usePhotoVersion();
  return useAsync<LinkedPhoto[]>(async (dc) => {
    if (!enabled) return [];
    const page = await fetchRows(dc, {
      start: 'Document',
      steps: [
        { filter: { property: 'status', op: 'eq', value: 'photo' } },
        { filter: { property: 'scenario', op: 'eq', value: investigation } },
      ],
      pageSize: 200,
    });
    return page.rows
      .map((r) => ({ documentId: r.pk, name: r.title, takenAt: r.properties.takenAt ? String(r.properties.takenAt) : null, url: fileUrl(dc, r.pk), importedAt: String(r.properties.importedAt ?? '') }))
      .sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  }, `investigation-photos:${investigation}:${enabled}:${v}`);
}

/** Link, unlink and pick the picture; each tells every photo piece to read again. */
export async function linkPhoto(dc: DataClient, documentId: string, objectKey: string) {
  await linkImage(dc, documentId, objectKey);
  photosChanged();
}

export async function unlinkPhoto(dc: DataClient, documentId: string, objectKey: string) {
  await unlinkImage(dc, documentId, objectKey);
  photosChanged();
}

export async function makeTheirPhoto(dc: DataClient, objectKey: string, documentId: string) {
  await setPhoto(dc, objectKey, documentId);
  photosChanged();
}

/** After an import or a delete elsewhere, read again. */
export { photosChanged };

/**
 * A photo's date taken as "14 Sep 2026, 09:20", in Philippine time. The engine stores the moment in UTC and reads a file
 * that carries no zone as Philippine time (+08:00, engine-api.md 2.11), so this is the clock the file was read in.
 */
const TAKEN = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** Three letters each, as the engine's passage text writes them ("Sep", never "Sept"). */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function takenLabel(takenAt: string | null | undefined): string | null {
  if (!takenAt) return null;
  const at = new Date(takenAt);
  if (Number.isNaN(at.getTime())) return null;
  const part = Object.fromEntries(TAKEN.formatToParts(at).map((p) => [p.type, p.value]));
  return `${Number(part.day)} ${MONTHS[Number(part.month) - 1]} ${part.year}, ${part.hour}:${part.minute}`;
}
