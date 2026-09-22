import type { Metadata } from 'next';
import EditorialGallery from './editorial-gallery';
import './gallery.css';

export const metadata: Metadata = {
  title: 'The Photographs — Frederick & Veronica',
  description: 'Our love, in moments. Explore a curated collection of Frederick and Veronica’s portraits, save your favourites and watch the full-screen slideshow.',
  alternates: { canonical: '/gallery' },
};

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ collection?: string }> }) {
  const { collection } = await searchParams;
  return <EditorialGallery initialCollection={collection === 'Together' || collection === 'Tradition' ? collection : 'All portraits'} />;
}
