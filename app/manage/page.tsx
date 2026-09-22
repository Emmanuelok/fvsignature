import {isOrganizer, organizerEnabled} from '@/lib/organizer';
import {getWeddingEvent} from '@/lib/event-server';
import {getDatabase} from '@/db';
import {Organizer} from './workspace';
import {OrganizerLogin} from './login';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = {title: 'Wedding Organizer — Frederick & Veronica', robots: {index: false, follow: false}};
const errors: Record<string, string> = {
  password: 'The password was not recognised. Please try again.',
  limited: 'Too many sign-in attempts. Please wait 15 minutes before trying again.',
  invalid: 'Please enter your organizer password.',
  origin: 'Please sign in from this website.',
  unavailable: 'Organizer sign-in is temporarily unavailable. Please try again later.',
};

export default async function Manage({searchParams}: {searchParams: Promise<{error?: string}>}) {
  if (!await isOrganizer()) {
    const params = await searchParams;
    return <main className="organizer-lock"><a href="/" className="monogram">F&V</a><h1>Wedding<br/><i>organizer.</i></h1><p>This page is reserved for the website organizer. Guest responses and messages are private.</p>{organizerEnabled() ? <OrganizerLogin initialError={typeof params.error === 'string' && Object.hasOwn(errors, params.error) ? errors[params.error] : ''}/> : <p>Organizer sign-in is not available yet. The website administrator needs to finish setting up secure access.</p>}<a className="text-link" href="/">Return to the wedding</a></main>;
  }
  try {
    const db = getDatabase();
    const [event, rsvps, wishes] = await Promise.all([getWeddingEvent(), db.prepare('SELECT * FROM rsvps ORDER BY created_at DESC LIMIT 2000').all(), db.prepare('SELECT * FROM wishes ORDER BY created_at DESC LIMIT 2000').all()]);
    return <Organizer event={event} rsvps={rsvps.results as never[]} wishes={wishes.results as never[]}/>;
  } catch {
    return <main className="organizer-lock"><h1>Just a moment.</h1><p>The organizer workspace is temporarily unavailable. Please refresh in a moment.</p><a href="/manage" className="text-link">Refresh workspace</a></main>;
  }
}
