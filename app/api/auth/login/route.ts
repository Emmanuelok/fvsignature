import {NextResponse} from 'next/server';
import {allowOrganizerLogin, organizerEnabled, ORGANIZER_COOKIE, organizerCookieOptions} from '@/lib/organizer';
import {checkOrganizerPassword, createOrganizerSession, organizerConfig, sameOrigin} from '@/lib/organizer-security';
import {WEDDING_ORGANIZER_BACKEND_ENABLED} from '@/lib/backend-config';

export const runtime = 'nodejs';
const messages = {
  unavailable: 'Organizer sign-in is temporarily unavailable. Please try again later.',
  password: 'The password was not recognised. Please try again.',
  limited: 'Too many sign-in attempts. Please wait 15 minutes before trying again.',
  invalid: 'Please enter your organizer password.',
  origin: 'Please sign in from this website.',
};

function failure(request: Request, code: keyof typeof messages, status: number, retryAfter?: number) {
  const json = (request.headers.get('content-type') || '').includes('application/json');
  const response = json ? NextResponse.json({error: messages[code]}, {status}) : NextResponse.redirect(new URL(`/manage?error=${code}`, request.url), 303);
  response.headers.set('Cache-Control', 'no-store');
  if (retryAfter) response.headers.set('Retry-After', String(retryAfter));
  return response;
}

async function readPassword(request: Request): Promise<string | null> {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json') && !type.includes('application/x-www-form-urlencoded')) return null;
  if (Number(request.headers.get('content-length')) > 4096 || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) {await reader.cancel(); return null;}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const raw = Buffer.concat(chunks).toString('utf8');
  const value: unknown = type.includes('application/json') ? JSON.parse(raw).password : new URLSearchParams(raw).get('password');
  return typeof value === 'string' && value.length > 0 && value.length <= 256 ? value : null;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure(request, 'origin', 403);
  if (WEDDING_ORGANIZER_BACKEND_ENABLED) return failure(request, 'unavailable', 503);
  const config = organizerConfig();
  if (!config || !organizerEnabled()) return failure(request, 'unavailable', 503);
  try {
    const limit = await allowOrganizerLogin(request, config);
    if (!limit.allowed) return failure(request, 'limited', 429, limit.retryAfter);
    let password: string | null;
    try {password = await readPassword(request);} catch {return failure(request, 'invalid', 400);}
    if (password === null) return failure(request, 'invalid', 400);
    if (!await checkOrganizerPassword(password, config)) return failure(request, 'password', 401);
    const json = (request.headers.get('content-type') || '').includes('application/json');
    const response = json ? NextResponse.json({success: true}) : NextResponse.redirect(new URL('/manage', request.url), 303);
    response.cookies.set(ORGANIZER_COOKIE, createOrganizerSession(config), organizerCookieOptions);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    console.error('Organizer sign-in is unavailable');
    return failure(request, 'unavailable', 503);
  }
}
