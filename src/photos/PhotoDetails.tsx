// What a photo says about itself, read on import with no model: date taken (in the file's own clock), place as
// coordinates, camera, size and format. One line says it is the file's claim: anyone can change these before the file
// arrives (limitations: metadata is a claim).
import { Section, SectionCard } from '@blueprintjs/core';
import type { PhotoMetadata } from '../data/index.ts';
import { takenLabel } from './reads';
import './photos.css';

export function photoFacts(meta: PhotoMetadata | null, format?: string): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const taken = takenLabel(meta?.takenAt);
  if (taken) rows.push(['Taken', taken]);
  if (meta?.latitude != null && meta?.longitude != null) rows.push(['Place', `${meta.latitude.toFixed(4)}, ${meta.longitude.toFixed(4)}`]);
  const make = meta?.cameraMake?.trim() ?? '';
  const model = meta?.cameraModel?.trim() ?? '';
  const camera = model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`.trim();
  if (camera) rows.push(['Camera', camera]);
  if (meta?.width && meta?.height) rows.push(['Size', `${meta.width} x ${meta.height}`]);
  if (format) rows.push(['Format', format.toUpperCase()]);
  return rows;
}

export function PhotoDetails({ meta, format }: { meta: PhotoMetadata | null; format?: string }) {
  const rows = photoFacts(meta, format);
  const said = rows.some(([k]) => k !== 'Format');
  return (
    <Section compact className="photo-card" title={<span className="caps-heading">Details</span>}>
      <SectionCard>
        {!said && <p className="bp6-text-muted">The file says nothing about when, where or with what it was taken.</p>}
        {rows.length > 0 && (
          <dl className="photo-facts">
            {rows.map(([k, v]) => (
              <div key={k} className="photo-facts__row">
                <dt className="bp6-text-muted">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="bp6-text-muted photo-facts__note">Read from the file. Anyone can change these before it reaches you.</p>
      </SectionCard>
    </Section>
  );
}
