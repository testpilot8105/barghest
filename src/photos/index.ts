// The photo pieces (Builder 4), for the screens that show photos: Files and Data Sources, the profile and its panel,
// the evidence drawer and the Timeline. Each screen's builder drops a piece in with the smallest edit; the pieces read
// what they need themselves and read again when a photo's links change.
export { EventPhoto } from './EventPhoto';
export { LinkTo } from './LinkTo';
export { PassagePicture } from './PassagePicture';
export { PhotoDetails, photoFacts } from './PhotoDetails';
export { PhotoFileView } from './PhotoFileView';
export { PhotoShows } from './PhotoShows';
export { ObjectPicture, PhotoThumb } from './PhotoThumb';
export { PhotoView } from './PhotoView';
export { ProfilePhotos } from './ProfilePhotos';
export { photosChanged, takenLabel, useObjectPhotos } from './reads';
