// A photo opened in Files (approved sketch, 10.10.2026): the picture as large as fits, and beside it DETAILS (what
// the file says about itself) and SHOWS (what the analyst linked it to). It replaces the passages column for a file
// whose status is `photo`; the file's header (name, register, Open original, Delete) stays Files' own.
import { Callout, Spinner } from '@blueprintjs/core';
import { fileUrl, useDataClient, useDocumentView } from '../data/index.ts';
import { PhotoDetails } from './PhotoDetails';
import { PhotoShows } from './PhotoShows';
import { PhotoView } from './PhotoView';
import './photos.css';

export function PhotoFileView({ investigation, documentId }: { investigation: string; documentId: string }) {
  const { dc } = useDataClient();
  const view = useDocumentView(documentId);
  if (view.error && !view.data)
    return (
      <Callout intent="danger" compact>
        This photo could not be read: {view.error.message}
      </Callout>
    );
  if (!view.data || !dc) return <Spinner size={20} />;
  const { document, photo, depicts } = view.data;
  return (
    <div className="photo-file">
      <PhotoView url={fileUrl(dc, document.documentId)} name={document.title} format={document.format} />
      <div className="photo-file__side">
        <PhotoDetails meta={photo} format={document.format} />
        <PhotoShows investigation={investigation} documentId={document.documentId} depicts={depicts} onChanged={view.reload} />
      </div>
    </div>
  );
}
