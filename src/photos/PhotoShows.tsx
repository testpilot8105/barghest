// SHOWS: everything a photo is linked to, each with its own picture (or its type icon), a name that opens its profile,
// Unlink, and "Use as their photo", or a "Their photo" tag when it already is. Link to… adds another.
import { useState, type MouseEvent } from 'react';
import { Button, Section, SectionCard, Tag } from '@blueprintjs/core';
import { fileUrl, useDataClient } from '../data/index.ts';
import { typeIcon } from '../graph/icons';
import { toast } from '../intake/toaster';
import { navigate, OBJECT_PARAM, viewHref } from '../shell/route';
import { LinkTo } from './LinkTo';
import { PhotoThumb } from './PhotoThumb';
import { linkPhoto, makeTheirPhoto, unlinkPhoto, useObjectPictures } from './reads';
import './photos.css';

const failed = (what: string) => (e: unknown) => toast(`${what}: ${e instanceof Error ? e.message : String(e)}`);

export function PhotoShows({
  investigation,
  documentId,
  depicts,
  onChanged,
}: {
  investigation: string;
  documentId: string;
  depicts: Array<{ type: string; pk: string; title: string }>;
  onChanged: () => void;
}) {
  const { dc } = useDataClient();
  const pictures = useObjectPictures(depicts);
  const [working, setWorking] = useState<string | null>(null);
  const linked = new Set(depicts.map((d) => `${d.type}:${d.pk}`));

  async function act(key: string, what: string, run: () => Promise<void>) {
    setWorking(key);
    try {
      await run();
      onChanged();
    } catch (e) {
      failed(what)(e);
    } finally {
      setWorking(null);
    }
  }

  return (
    <Section compact className="photo-card" title={<span className="caps-heading">Shows</span>} rightElement={<span className="bp6-text-muted">{depicts.length}</span>}>
      <SectionCard className="photo-shows">
        {depicts.length === 0 && <p className="bp6-text-muted">Not linked to anything yet. Link it to the person, vehicle or firearm it shows.</p>}
        {depicts.map((d) => {
          const key = `${d.type}:${d.pk}`;
          const picture = pictures.data?.get(key) ?? null;
          const theirs = picture === documentId;
          const Icon = typeIcon(d.type);
          const href = `${viewHref(investigation, 'browser')}?${new URLSearchParams({ [OBJECT_PARAM]: key })}`;
          return (
            <div key={key} className="photo-shows__row">
              {picture && dc ? (
                <PhotoThumb url={fileUrl(dc, picture)} name={picture} size={40} />
              ) : (
                <span className="photo-thumb photo-thumb--none photo-shows__icon" aria-hidden>
                  <Icon />
                </span>
              )}
              <a
                className="photo-shows__name"
                href={href}
                onClick={(e: MouseEvent) => {
                  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  navigate(href);
                }}
              >
                <span className="photo-shows__title">{d.title}</span>
                <span className="bp6-text-muted">{dc?.catalog.types[d.type]?.displayName ?? d.type}</span>
              </a>
              {theirs ? (
                <Tag size="large" minimal intent="success" className="photo-tag">
                  Their photo
                </Tag>
              ) : (
                <Button
                  size="small"
                  variant="minimal"
                  text="Use as their photo"
                  loading={working === `${key}:use`}
                  onClick={() => dc && act(`${key}:use`, 'Could not set their photo', () => makeTheirPhoto(dc, key, documentId))}
                />
              )}
              <Button
                size="small"
                variant="minimal"
                text="Unlink"
                loading={working === `${key}:unlink`}
                onClick={() => dc && act(`${key}:unlink`, 'Unlink failed', () => unlinkPhoto(dc, documentId, key))}
              />
            </div>
          );
        })}
        <LinkTo
          investigation={investigation}
          linked={linked}
          onPick={async (hit) => {
            if (!dc) return;
            await linkPhoto(dc, documentId, `${hit.type}:${hit.pk}`).then(onChanged, failed('Link failed'));
          }}
        />
      </SectionCard>
    </Section>
  );
}
