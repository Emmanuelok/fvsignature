import {getDatabase} from '@/db';
import {readSubmission, hexId} from '@/lib/submission';
import {createRsvpHandlers} from '@/lib/rsvp-service';
import {WEDDING_GUEST_BACKEND_ENABLED} from '@/lib/backend-config';
import {publicWeddingBackend} from '@/lib/public-backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const legacyHandlers = createRsvpHandlers({
  database: getDatabase,
  read: readSubmission,
  id: hexId,
  // Keep names, email addresses, notes, credentials and driver messages out of logs.
  log: (code, requestId) => console.error(JSON.stringify({event: 'rsvp_storage_failed', code, requestId})),
});

export async function GET() {
  return WEDDING_GUEST_BACKEND_ENABLED ? publicWeddingBackend.getRsvpAvailability() : legacyHandlers.GET();
}

export async function POST(request: Request) {
  return WEDDING_GUEST_BACKEND_ENABLED ? publicWeddingBackend.submitRsvp(request) : legacyHandlers.POST(request);
}
