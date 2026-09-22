import type { Metadata } from 'next';
import './globals.css';
import './upgrade.css';
import './cinematic.css';
import './invitation.css';
import {getWeddingEvent} from '@/lib/event-server';
import {EventProvider} from './event-context';
export const dynamic='force-dynamic';
export const metadata: Metadata = {
 title: 'Frederick & Veronica — A Lifetime of Us',
 description: 'Celebrate the wedding of Frederick Amokohene and Veronica Owusu. Explore their photographs, find celebration details, and leave a wish for the couple.',
 icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
};
export default async function RootLayout({children}:{children:React.ReactNode}) {const event=await getWeddingEvent();return <html lang="en"><body><a href="#main" className="skip-link">Skip to content</a><EventProvider event={event}>{children}</EventProvider></body></html>}
