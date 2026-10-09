// A linked photo's event on a timeline (kind `depicts`, at the date taken) shows a small picture in its row (approved
// sketch, 10.10.2026). Any other event draws nothing. The photo is the event's `Document:` object.
import { fileUrl, useDataClient } from '../data/index.ts';
import { PhotoThumb } from './PhotoThumb';
import './photos.css';

export function EventPhoto({ kind, objectIds }: { kind: string; objectIds: string[] }) {
  const { dc } = useDataClient();
  const doc = kind === 'depicts' ? objectIds.find((k) => k.startsWith('Document:')) : undefined;
  if (!doc || !dc) return null;
  return <PhotoThumb url={fileUrl(dc, doc.slice('Document:'.length))} name="photo.jpg" size={24} className="photo-event" />;
}
