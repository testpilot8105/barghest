// A passage that comes from a photo shows the picture above its text (the evidence drawer, approved sketch 10.10.2026).
// It reads the passage's file once and draws nothing for any file that is not a photo.
import { fetchRows, fileUrl, hasNoPreview, useAsync } from '../data/index.ts';
import { PhotoView } from './PhotoView';
import './photos.css';

export function PassagePicture({ documentId }: { documentId: string | null | undefined }) {
  const doc = useAsync(async (dc) => {
    if (!documentId) return null;
    const page = await fetchRows(dc, { start: 'Document', steps: [{ filter: { property: 'documentId', op: 'eq', value: documentId } }], pageSize: 1 });
    const row = page.rows[0];
    if (!row || row.properties.status !== 'photo') return null;
    return { url: fileUrl(dc, row.pk), name: row.title, format: String(row.properties.format ?? '') };
  }, `passage-picture:${documentId ?? ''}`);
  const photo = doc.data;
  if (!photo) return null;
  return (
    <div className={`photo-passage${hasNoPreview(photo.format || photo.name) ? ' photo-passage--none' : ''}`}>
      <PhotoView url={photo.url} name={photo.name} format={photo.format} />
    </div>
  );
}
