// Photos in the data layer (engine-api.md 2.11): which formats are pictures, so a screen shows them through <img>
// and never asks the model to read them. The same list the engine's `health.formats` carries for images.
export const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'bmp', 'tif', 'tiff', 'heic', 'heif'] as const;

/** Formats Chrome cannot show: they import with their metadata read and get "No preview in this browser". */
export const NO_PREVIEW_FORMATS = ['tif', 'tiff', 'heic', 'heif'] as const;

/** True for a format ("jpg") or a file name ("locker.JPG") that is a photo. */
export function isImage(formatOrName: string): boolean {
  const s = String(formatOrName ?? '').trim().toLowerCase();
  const dot = s.lastIndexOf('.');
  const ext = dot >= 0 ? s.slice(dot + 1) : s;
  return (IMAGE_FORMATS as readonly string[]).includes(ext);
}

/** True when the browser cannot render the photo itself (HEIC, HEIF, TIFF). */
export function hasNoPreview(formatOrName: string): boolean {
  const s = String(formatOrName ?? '').trim().toLowerCase();
  const dot = s.lastIndexOf('.');
  const ext = dot >= 0 ? s.slice(dot + 1) : s;
  return (NO_PREVIEW_FORMATS as readonly string[]).includes(ext);
}
