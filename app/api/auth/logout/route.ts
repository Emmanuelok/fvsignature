import {NextResponse} from 'next/server';
import {ORGANIZER_COOKIE, organizerCookieOptions} from '@/lib/organizer';
import {sameOrigin} from '@/lib/organizer-security';
import {WEDDING_ORGANIZER_BACKEND_ENABLED} from '@/lib/backend-config';
import {weddingOrganizerUrl} from '@/lib/public-backend';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({error: 'Please sign out from this website.'}, {status: 403, headers: {'Cache-Control': 'no-store'}});
  const response = NextResponse.redirect(WEDDING_ORGANIZER_BACKEND_ENABLED ? weddingOrganizerUrl : new URL('/manage', request.url), 303);
  response.cookies.set(ORGANIZER_COOKIE, '', {...organizerCookieOptions, maxAge: 0, expires: new Date(0)});
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
