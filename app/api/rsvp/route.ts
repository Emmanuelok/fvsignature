import {getDatabase} from '@/db';
import {readSubmission, hexId} from '@/lib/submission';
import {createRsvpHandlers} from '@/lib/rsvp-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const {GET, POST} = createRsvpHandlers({
  database: getDatabase,
  read: readSubmission,
  id: hexId,
  // Keep names, email addresses, notes, credentials and driver messages out of logs.
  log: (code, requestId) => console.error(JSON.stringify({event: 'rsvp_storage_failed', code, requestId})),
});
