// A photo, small: a square crop of the picture where another file shows its icon (Files, Data Sources, a timeline row,
// the objects a photo shows). HEIC and TIFF, which Chrome cannot draw, and a file that fails to draw show the plain
// picture icon instead. Pictures only ever go through <img> (engine-api.md 2.11).
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Media } from '@blueprintjs/icons';
import { hasNoPreview } from '../data/index.ts';
import { useObjectPhotos } from './reads';
import './photos.css';

const sized = (size: number) => ({ '--photo-thumb': `${size}px` }) as CSSProperties;

export function PhotoThumb({ url, name, size = 30, className = '' }: { url: string | null | undefined; name: string; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken || hasNoPreview(name))
    return (
      <span className={`photo-thumb photo-thumb--none ${className}`} style={sized(size)} aria-hidden>
        <Media />
      </span>
    );
  return <img className={`photo-thumb ${className}`} style={sized(size)} src={url} alt="" loading="lazy" onError={() => setBroken(true)} />;
}

/**
 * A profile's header picture: the object's photo where its type icon is now, and the icon (`fallback`) when it has
 * none. Reads again when a photo is linked, unlinked or picked.
 */
export function ObjectPicture({ objectKey, fallback, size = 56 }: { objectKey: string; fallback: ReactNode; size?: number }) {
  const photos = useObjectPhotos(objectKey);
  const url = photos.data?.photo?.url;
  const [broken, setBroken] = useState<string | null>(null);
  if (!url || broken === url) return <>{fallback}</>;
  return <img className="photo-picture" style={sized(size)} src={url} alt="" onError={() => setBroken(url)} />;
}
