// PHOTOS on a profile (approved sketch, 10.10.2026): every photo linked to the object, newest taken first, each with
// its date and file name. A click opens it large in a Dialog and the profile stays underneath. The "…" on a photo has
// Use as photo, Open in Files and Unlink; "Their photo" marks the one the header and the graph show. Add photo… picks
// from this investigation's photos or imports a new one and links it in the same step.
import { useEffect, useRef, useState } from 'react';
import { AnchorButton, Button, Dialog, DialogBody, DialogFooter, Menu, MenuItem, Popover, Section, SectionCard, Spinner, Tag } from '@blueprintjs/core';
import { Document, IdNumber, Import, Media, More, Unlink } from '@blueprintjs/icons';
import { importFile, isImage, useDataClient, useDocumentView, type DataClient } from '../data/index.ts';
import { toast } from '../intake/toaster';
import { fileHref, navigate } from '../shell/route';
import { photoFacts } from './PhotoDetails';
import { PhotoThumb } from './PhotoThumb';
import { PhotoView } from './PhotoView';
import { linkPhoto, makeTheirPhoto, photosChanged, takenLabel, unlinkPhoto, useInvestigationPhotos, useObjectPhotos, type LinkedPhoto } from './reads';
import './photos.css';

const failed = (what: string, e: unknown) => toast(`${what}: ${e instanceof Error ? e.message : String(e)}`);
/** What the file picker offers: every format the engine imports as a photo (engine-api.md 2.11). */
const ACCEPT = 'image/*,.heic,.heif,.tif,.tiff,.avif';

export function ProfilePhotos({ investigation, objectKey, title }: { investigation: string; objectKey: string; title: string }) {
  const { dc } = useDataClient();
  const photos = useObjectPhotos(objectKey);
  const [large, setLarge] = useState<LinkedPhoto | null>(null);
  const [picking, setPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const images = photos.data?.images ?? [];
  const current = photos.data?.photo?.documentId ?? null;

  async function run(what: string, job: (dc: DataClient) => Promise<void>) {
    if (!dc) return;
    try {
      await job(dc);
    } catch (e) {
      failed(what, e);
    }
  }

  async function importAndLink(file: File) {
    if (!dc) return;
    // Only a photo comes in here: any other file would go to the model, and that is Files' job.
    if (!isImage(file.name)) {
      toast(`${file.name} is not a photo. Import other files in Files.`);
      return;
    }
    setImporting(true);
    try {
      const made = await importFile(dc, { file, investigation });
      await linkPhoto(dc, made.documentId, objectKey);
    } catch (e) {
      failed(`${file.name} was not added`, e);
    } finally {
      setImporting(false);
      photosChanged();
    }
  }

  const addMenu = (
    <Menu>
      <MenuItem icon={<Media />} text="From this investigation’s photos…" onClick={() => setPicking(true)} />
      <MenuItem icon={<Import />} text="Import a new photo…" onClick={() => fileInput.current?.click()} />
    </Menu>
  );

  return (
    <Section
      compact
      className="photo-card photos-section"
      title={<span className="caps-heading">Photos</span>}
      rightElement={
        <span className="photos-section__right">
          <Popover content={addMenu} placement="bottom-end">
            <Button variant="minimal" size="small" icon={<Import />} text="Add photo…" loading={importing} />
          </Popover>
          <span className="bp6-text-muted">{images.length}</span>
        </span>
      }
    >
      <SectionCard>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) void importAndLink(file);
          }}
        />
        {photos.loading && !photos.data ? (
          <Spinner size={20} />
        ) : images.length === 0 ? (
          <p className="bp6-text-muted">No photo is linked yet. Add photo… picks one from this investigation or imports a new one.</p>
        ) : (
          <div className="photos-grid">
            {images.map((img) => {
              const theirs = img.documentId === current;
              const menu = (
                <Menu>
                  <MenuItem icon={<IdNumber />} text="Use as photo" disabled={theirs} onClick={() => run('Could not set the photo', (dc) => makeTheirPhoto(dc, objectKey, img.documentId))} />
                  <MenuItem icon={<Document />} text="Open in Files" onClick={() => navigate(fileHref(investigation, img.documentId))} />
                  <MenuItem icon={<Unlink />} intent="danger" text="Unlink" onClick={() => run('Unlink failed', (dc) => unlinkPhoto(dc, img.documentId, objectKey))} />
                </Menu>
              );
              return (
                <figure key={img.documentId} className="photos-tile">
                  <button type="button" className="photos-tile__open" aria-label={`Open ${img.name} large`} onClick={() => setLarge(img)}>
                    <PhotoThumb url={img.url} name={img.name} className="photos-tile__picture" />
                  </button>
                  {theirs && (
                    <Tag intent="success" size="large" className="photo-tag photos-tile__theirs">
                      Their photo
                    </Tag>
                  )}
                  <Popover content={menu} placement="bottom-end" className="photos-tile__more-wrap">
                    <Button className="photos-tile__more" size="small" icon={<More />} aria-label={`Use, open or unlink ${img.name}`} />
                  </Popover>
                  <figcaption>
                    <span>{takenLabel(img.takenAt) ?? 'Date not in the file'}</span>
                    <span className="bp6-text-muted photos-tile__name">{img.name}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </SectionCard>
      <LargePhoto
        investigation={investigation}
        photo={large}
        theirs={large?.documentId === current}
        onClose={() => setLarge(null)}
        onUse={(p) => run('Could not set the photo', (dc) => makeTheirPhoto(dc, objectKey, p.documentId))}
        onUnlink={(p) =>
          run('Unlink failed', async (dc) => {
            await unlinkPhoto(dc, p.documentId, objectKey);
            setLarge(null);
          })
        }
      />
      <PickPhoto
        investigation={investigation}
        title={title}
        open={picking}
        linked={new Set(images.map((i) => i.documentId))}
        onClose={() => setPicking(false)}
        onPick={(p) =>
          run('Link failed', async (dc) => {
            await linkPhoto(dc, p.documentId, objectKey);
            setPicking(false);
          })
        }
      />
    </Section>
  );
}

/** One photo, large, over the profile: its details on one line, then Use as photo (or the tag), Open in Files, Unlink. */
function LargePhoto({
  investigation,
  photo,
  theirs,
  onClose,
  onUse,
  onUnlink,
}: {
  investigation: string;
  photo: LinkedPhoto | null;
  theirs: boolean;
  onClose: () => void;
  onUse: (p: LinkedPhoto) => void;
  onUnlink: (p: LinkedPhoto) => void;
}) {
  const view = useDocumentView(photo?.documentId ?? null);
  const facts = view.data ? photoFacts(view.data.photo, view.data.document.format).map(([, v]) => v) : [];
  return (
    <Dialog isOpen={photo != null} onClose={onClose} title={photo?.name} icon={<Media />} className="photos-dialog">
      {photo && (
        <>
          <DialogBody className="photos-dialog__body">
            <PhotoView url={photo.url} name={photo.name} format={view.data?.document.format} />
            {facts.length > 0 && <p className="bp6-text-muted photos-dialog__facts">{facts.join('   ·   ')}</p>}
          </DialogBody>
          <DialogFooter
            actions={
              <>
                <AnchorButton
                  variant="outlined"
                  icon={<Document />}
                  text="Open in Files"
                  href={fileHref(investigation, photo.documentId)}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(fileHref(investigation, photo.documentId));
                  }}
                />
                <Button variant="minimal" icon={<Unlink />} text="Unlink" onClick={() => onUnlink(photo)} />
              </>
            }
          >
            {theirs ? (
              <Tag intent="success" size="large" className="photo-tag">
                Their photo
              </Tag>
            ) : (
              <Button variant="minimal" icon={<IdNumber />} text="Use as photo" onClick={() => onUse(photo)} />
            )}
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}

/** From this investigation's photos…: every photo in the investigation, the linked ones dimmed; pick one, then Link. */
function PickPhoto({
  investigation,
  title,
  open,
  linked,
  onClose,
  onPick,
}: {
  investigation: string;
  title: string;
  open: boolean;
  linked: Set<string>;
  onClose: () => void;
  onPick: (p: LinkedPhoto) => void;
}) {
  const all = useInvestigationPhotos(investigation, open);
  const [picked, setPicked] = useState<LinkedPhoto | null>(null);
  useEffect(() => {
    if (!open) setPicked(null);
  }, [open]);
  const close = () => {
    setPicked(null);
    onClose();
  };
  const list = all.data ?? [];
  return (
    <Dialog isOpen={open} onClose={close} title={`Add a photo of ${title}`} icon={<Media />} className="photos-pick">
      <DialogBody>
        {all.loading && !all.data ? (
          <Spinner size={20} />
        ) : list.length === 0 ? (
          <p className="bp6-text-muted">This investigation has no photos yet. Import one from the Photos card or from Files.</p>
        ) : (
          <div className="photos-pick__grid">
            {list.map((p) => {
              const done = linked.has(p.documentId);
              const on = picked?.documentId === p.documentId;
              return (
                <button
                  key={p.documentId}
                  type="button"
                  className={`photos-pick__tile${on ? ' photos-pick__tile--picked' : ''}${done ? ' photos-pick__tile--linked' : ''}`}
                  disabled={done}
                  aria-pressed={on}
                  onClick={() => setPicked(p)}
                  onDoubleClick={() => onPick(p)}
                >
                  <PhotoThumb url={p.url} name={p.name} className="photos-pick__picture" />
                  {done && (
                    <Tag size="large" className="photo-tag photos-pick__linked">
                      Linked
                    </Tag>
                  )}
                  <span className="photos-pick__name">{p.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button text="Cancel" onClick={close} />
            <Button intent="primary" text="Link" disabled={!picked} onClick={() => picked && onPick(picked)} />
          </>
        }
      >
        <span className="bp6-text-muted">{picked ? `Picked: ${picked.name}` : 'Pick the photo that shows them.'}</span>
      </DialogFooter>
    </Dialog>
  );
}
