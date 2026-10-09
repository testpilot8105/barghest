// A photo, large: the picture letterboxed on black, as big as the space allows. HEIC and TIFF (Chrome cannot draw them)
// and a file that fails to draw say so plainly, with Open original; the photo's details and links still work beside it.
import { useState } from 'react';
import { AnchorButton, NonIdealState } from '@blueprintjs/core';
import { Media, Share } from '@blueprintjs/icons';
import { hasNoPreview } from '../data/index.ts';
import './photos.css';

const extension = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toUpperCase() : name.toUpperCase();
};

export function PhotoView({ url, name, format }: { url: string; name: string; format?: string }) {
  const [broken, setBroken] = useState(false);
  const noPreview = hasNoPreview(format || name);
  if (noPreview || broken)
    return (
      <div className="photo-view photo-view--none">
        <NonIdealState
          icon={<Media size={48} />}
          title={noPreview ? 'No preview in this browser' : 'This photo can’t be shown'}
          description={noPreview ? `Chrome can’t draw ${extension(format || name)} files. Its details and links still work.` : 'The file did not draw as a picture. Its details and links still work.'}
          action={<AnchorButton variant="outlined" icon={<Share />} text="Open original" href={url} target="_blank" rel="noreferrer" />}
        />
      </div>
    );
  return (
    <div className="photo-view">
      <img src={url} alt={name} onError={() => setBroken(true)} />
    </div>
  );
}
