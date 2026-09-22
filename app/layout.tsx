import type { Metadata } from 'next';
import './globals.css';
import './upgrade.css';
import './cinematic.css';
import './invitation.css';
import {getWeddingEvent} from '@/lib/event-server';
import {EventProvider} from './event-context';
export const dynamic='force-dynamic';

// Use the public production address so previews also resolve a shareable image.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
 || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
 || 'https://fvsignature.vercel.app';
const metadataBase = new URL(/^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`);
const shareTitle = 'Frederick & Veronica — A Lifetime of Us';
const shareDescription = "Join Frederick Amokohene and Veronica Owusu on October 10, 2026 at 12:00 noon at St. James United Church, St. John's, Newfoundland. Wedding details, directions and RSVP.";
const shareImage = {
 url: '/og-frederick-veronica.jpg',
 width: 1200,
 height: 630,
 type: 'image/jpeg',
 alt: "Frederick Amokohene and Veronica Owusu — October 10, 2026, 12:00 noon, St. James United Church, St. John's.",
};

export const metadata: Metadata = {
 metadataBase,
 title: shareTitle,
 description: shareDescription,
 openGraph: {
  type: 'website',
  locale: 'en_CA',
  url: '/',
  siteName: 'Frederick & Veronica',
  title: shareTitle,
  description: shareDescription,
  images: [shareImage],
 },
 twitter: {
  card: 'summary_large_image',
  title: shareTitle,
  description: shareDescription,
  images: [{url: shareImage.url, alt: shareImage.alt}],
 },
 icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
};
export default async function RootLayout({children}:{children:React.ReactNode}) {const event=await getWeddingEvent();return <html lang="en"><body><a href="#main" className="skip-link">Skip to content</a><EventProvider event={event}>{children}</EventProvider></body></html>}
