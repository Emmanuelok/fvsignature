import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomBytes, scryptSync} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkOrganizerPassword, createOrganizerSession, organizerConfig, sameOrigin, SESSION_SECONDS, validOrganizerSession} from '../lib/organizer-security.ts';

const password = 'A unique test-only organizer password';
const salt = randomBytes(16);
const key = scryptSync(password, salt, 64, {N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024});
const config = {passwordHash: `scrypt$32768$8$1$${salt.toString('hex')}$${key.toString('hex')}`, sessionSecret: randomBytes(32).toString('hex')};
const now = Date.UTC(2026, 8, 22, 12);

test('password hashes verify only the correct password', async () => {
  assert.equal(await checkOrganizerPassword(password, config), true);
  assert.equal(await checkOrganizerPassword('incorrect password', config), false);
  assert.equal(await checkOrganizerPassword('x'.repeat(257), config), false);
});

test('password setup script accepts stdin and rejects command-line secrets', async () => {
  const script = fileURLToPath(new URL('../scripts/hash-organizer-password.mjs', import.meta.url));
  const generated = spawnSync(process.execPath, [script], {input: password + '\n', encoding: 'utf8'});
  assert.equal(generated.status, 0);
  const prepared = organizerConfig({ORGANIZER_PASSWORD_HASH: generated.stdout.trim(), SESSION_SECRET: config.sessionSecret});
  assert.ok(prepared);
  assert.equal(await checkOrganizerPassword(password, prepared), true);
  assert.equal(generated.stdout.includes(password), false);
  const rejected = spawnSync(process.execPath, [script, 'do-not-accept-argv'], {encoding: 'utf8'});
  assert.equal(rejected.status, 1);
  assert.equal(rejected.stdout, '');
});

test('session rejects tampering, expiration, future issuance and secret rotation', () => {
  const session = createOrganizerSession(config, now);
  assert.equal(validOrganizerSession(session, config, now), true);
  assert.equal(validOrganizerSession(session, config, now + SESSION_SECONDS * 1000 - 1), true);
  assert.equal(validOrganizerSession(session, config, now + SESSION_SECONDS * 1000), false);
  assert.equal(validOrganizerSession(session + 'a', config, now), false);
  const pieces = session.split('.');
  pieces[2] = String(Number(pieces[2]) + 3600);
  assert.equal(validOrganizerSession(pieces.join('.'), config, now), false);
  assert.equal(validOrganizerSession(createOrganizerSession(config, now + 60000), config, now), false);
  assert.equal(validOrganizerSession(session, {...config, sessionSecret: randomBytes(32).toString('hex')}, now), false);
  assert.equal(validOrganizerSession(session, {...config, passwordHash: config.passwordHash.replace(/.$/, config.passwordHash.endsWith('0') ? '1' : '0')}, now), false);
  for (const malformed of [undefined, '', 'x'.repeat(10000), 'v1.0.1.abcd.sig']) assert.equal(validOrganizerSession(malformed, config, now), false);
});

test('secure configuration fails closed for missing or malformed credentials', () => {
  assert.deepEqual(organizerConfig({ORGANIZER_PASSWORD_HASH: config.passwordHash, SESSION_SECRET: config.sessionSecret}), config);
  assert.equal(organizerConfig({}), null);
  assert.equal(organizerConfig({ORGANIZER_PASSWORD_HASH: 'plain password', SESSION_SECRET: config.sessionSecret}), null);
  assert.equal(organizerConfig({ORGANIZER_PASSWORD_HASH: config.passwordHash, SESSION_SECRET: 'short'}), null);
});

test('mutation origin checks reject cross-origin, missing and opaque origins', () => {
  const request = (origin, site) => new Request('https://wedding.example/api/auth/login', {method: 'POST', headers: {...(origin ? {origin} : {}), ...(site ? {'sec-fetch-site': site} : {})}});
  assert.equal(sameOrigin(request('https://wedding.example', 'same-origin')), true);
  assert.equal(sameOrigin(request('https://attacker.example')), false);
  assert.equal(sameOrigin(request('https://wedding.example', 'cross-site')), false);
  assert.equal(sameOrigin(request('http://wedding.example')), false);
  assert.equal(sameOrigin(request('null')), false);
  assert.equal(sameOrigin(request(undefined)), false);
});
