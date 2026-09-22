import {createHmac, randomBytes, scrypt, timingSafeEqual} from 'node:crypto';

export const SESSION_SECONDS = 8 * 60 * 60;
export const PASSWORD_PATTERN = /^scrypt\$32768\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/;
export type OrganizerConfig = {passwordHash: string; sessionSecret: string};

export function organizerConfig(env: Record<string, string | undefined> = process.env): OrganizerConfig | null {
  const passwordHash = env.ORGANIZER_PASSWORD_HASH?.trim();
  const sessionSecret = env.SESSION_SECRET;
  if (!passwordHash || !PASSWORD_PATTERN.test(passwordHash) || !sessionSecret || sessionSecret.trim().length < 32) return null;
  return {passwordHash, sessionSecret};
}

export async function checkOrganizerPassword(password: string, config: OrganizerConfig): Promise<boolean> {
  if (password.length > 256 || Buffer.byteLength(password, 'utf8') > 1024) return false;
  const parts = PASSWORD_PATTERN.exec(config.passwordHash);
  if (!parts) return false;
  const expected = Buffer.from(parts[2], 'hex');
  const actual = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, Buffer.from(parts[1], 'hex'), 64, {N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024}, (error, key) => error ? reject(error) : resolve(key));
  });
  return timingSafeEqual(actual, expected);
}

function signature(payload: string, config: OrganizerConfig): Buffer {
  // Binding sessions to the password hash also revokes sessions after a password change.
  return createHmac('sha256', config.sessionSecret).update(`organizer-session\0${config.passwordHash}\0${payload}`).digest();
}

export function createOrganizerSession(config: OrganizerConfig, now = Date.now()): string {
  const issued = Math.floor(now / 1000);
  const payload = `v1.${issued}.${issued + SESSION_SECONDS}.${randomBytes(24).toString('hex')}`;
  return `${payload}.${signature(payload, config).toString('base64url')}`;
}

export function validOrganizerSession(token: string | undefined, config: OrganizerConfig, now = Date.now()): boolean {
  if (!token || token.length > 250) return false;
  const match = /^(v1\.(\d{1,13})\.(\d{1,13})\.[a-f0-9]{48})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return false;
  const actual = Buffer.from(match[4], 'base64url');
  const expected = signature(match[1], config);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  const issued = Number(match[2]);
  const expires = Number(match[3]);
  const seconds = Math.floor(now / 1000);
  return Number.isSafeInteger(issued) && Number.isSafeInteger(expires) && issued <= seconds + 30 && expires > seconds && expires - issued === SESSION_SECONDS;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
