import selection from './gallery-photos.json';

export type GalleryPhoto = {
  id: string;
  title: string;
  collection: 'Together' | 'Tradition';
  alt: string;
  caption: string;
};

// One portrait from each similar pair; shared with the collection download.
export const galleryPhotos = selection as GalleryPhoto[];
