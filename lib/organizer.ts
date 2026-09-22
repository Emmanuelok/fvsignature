import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {cookies} from 'next/headers';
import {getDatabase} from '@/db';
import {organizerConfig, validOrganizerSession, type OrganizerConfig, SESSION_SECONDS} from './organizer-security';

export const ORGANIZER_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-fv-organizer' : 'fv-organizer';
export const organizerCookieOptions = {httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: SESSION_SECONDS};

export function organizerEnabled(): boolean {
  return organizerConfig() !== null && Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

export async function isOrganizer(): Promise<boolean> {
  const config = organizerConfig();
  if (!config || !(process.env.DATABASE_URL || process.env.POSTGRES_URL)) return false;
  return validOrganizerSession((await cookies()).get(ORGANIZER_COOKIE)?.value, config);
}

const WINDOW_MS = 15 * 60 * 1000;

async function consumeAttempt(key: string, limit: number, now: number): Promise<{allowed: boolean; retryAfter: number}> {
  // PostgreSQL serializes this UPSERT for each key, including simultaneous serverless requests.
  const row = await getDatabase().prepare(`
    INSERT INTO login_attempts (key, window_start, attempts) VALUES (?, ?, 1)
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN login_attempts.window_start <= ? THEN 1 ELSE LEAST(login_attempts.attempts + 1, ?) END,
      window_start = CASE WHEN login_attempts.window_start <= ? THEN ? ELSE login_attempts.window_start END
    RETURNING attempts, window_start
  `).bind(key, now, now - WINDOW_MS, limit + 1, now - WINDOW_MS, now).first<{attempts: number; window_start: number}>();
  if (!row) throw new Error('Login limiter unavailable');
  return {allowed: Number(row.attempts) <= limit, retryAfter: Math.max(1, Math.ceil((Number(row.window_start) + WINDOW_MS - now) / 1000))};
}

export async function allowOrganizerLogin(request: Request, config: OrganizerConfig): Promise<{allowed: boolean; retryAfter: number}> {
  const now = Date.now();
  const keyFor = (value: string) => createHmac('sha256', config.sessionSecret).update(`organizer-throttle\0${value}`).digest('hex');
  const global = await consumeAttempt(keyFor('global'), 100, now);
  if (!global.allowed) return global;
  // Only the Vercel platform's IP header is trusted, never caller-supplied identity headers.
  // Outside Vercel, all requests deliberately share a single conservative bucket.
  const forwarded = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for')?.trim() : undefined;
  const client = forwarded && isIP(forwarded) ? forwarded : 'shared';
  return consumeAttempt(keyFor(`client:${client}`), 5, now);
}
