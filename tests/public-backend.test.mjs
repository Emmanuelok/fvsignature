import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPublicBackendClient, weddingBackendOrigin} from '../lib/public-backend.ts';

const id = 'a1b2c3d4000000000000000000000000';
const reply = {id, name: 'Taylor Guest', email: 'guest@example.com', attendance: 'attending', guests: '1', children: '0'};
const event = {date: '2026-10-10', time: '12:00', venue: 'St. James United Church', address: "330 Elizabeth Ave, St. John's, NL A1B 1T9", timezone: 'America/St_Johns', dressCode: 'Dress for a church celebration.', note: ''};
const json = (data, status = 200, headers = {}) => Response.json(data, {status, headers});

function request(body = reply, headers = {}, form = false, kind = 'rsvp') {
  return new Request(`https://fvsignature.com/api/${kind}`, {
    method: 'POST',
    headers: {'Origin': 'https://fvsignature.com', 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json', ...headers},
    body: form ? new URLSearchParams(body) : JSON.stringify(body),
  });
}

function setup(respond) {
  const requests = [];
  const client = createPublicBackendClient({fetch: async (url, options) => {
    requests.push({url, options});
    return typeof respond === 'function' ? respond(url, options, requests.length) : respond.clone();
  }});
  return {...client, requests};
}

test('proxy reaches only the fixed endpoint and strips credentials and identity headers', async () => {
  const app = setup(json({success: true, reference: 'FV-A1B2C3D4', secret: 'not-public'}, 201, {'Set-Cookie': 'private=session'}));
  const response = await app.submitRsvp(request({...reply, url: 'https://attacker.example/manage'}, {
    Cookie: 'organizer=private', Authorization: 'Bearer private',
    'oai-authenticated-user-id': 'spoofed', 'oai-authenticated-user-email': 'spoofed@example.com',
    'X-Forwarded-For': '127.0.0.1',
  }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {success: true, reference: 'FV-A1B2C3D4'});
  assert.equal(response.headers.get('set-cookie'), null);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const {url, options} = app.requests[0];
  assert.equal(url, `${weddingBackendOrigin}/api/rsvp`);
  assert.deepEqual(options.headers, {'Accept': 'application/json', 'Content-Type': 'application/json'});
  assert.equal(options.credentials, 'omit');
  assert.equal(options.redirect, 'error');
  assert.equal(options.cache, 'no-store');
});

test('cross-site and malformed origins fail before contacting the backend', async () => {
  const app = setup(json({success: true, reference: 'FV-A1B2C3D4'}));
  for (const headers of [
    {Origin: 'https://other.example'}, {Origin: 'http://fvsignature.com'},
    {Origin: 'null'}, {Origin: 'not-a-url'}, {'Sec-Fetch-Site': 'cross-site'},
  ]) assert.equal((await app.submitRsvp(request(reply, headers))).status, 403);
  assert.equal(app.requests.length, 0);
});

test('incoming submissions are bounded by bytes, with malformed and unsupported bodies rejected', async () => {
  const app = setup(json({success: true, reference: 'FV-A1B2C3D4'}));
  for (const body of [[], null, 'text', {note: 'é'.repeat(7000)}]) {
    assert.equal((await app.submitRsvp(request(body))).status, 400);
  }
  const malformed = new Request('https://fvsignature.com/api/rsvp', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{'});
  assert.equal((await app.submitRsvp(malformed)).status, 400);
  assert.equal((await app.submitRsvp(request(reply, {'Content-Type': 'text/plain'}))).status, 400);
  assert.equal((await app.submitRsvp(request(reply, {'Content-Length': '12001'}))).status, 400);
  assert.equal((await app.submitWish(request({message: 'a'.repeat(8100)}))).status, 400);
  assert.equal(app.requests.length, 0);
});

test('HTML login pages, redirects, malformed JSON and oversized replies never confirm a save', async () => {
  for (const upstream of [
    new Response('<h1>Sign in</h1>', {headers: {'Content-Type': 'text/html'}}),
    Response.redirect(`${weddingBackendOrigin}/signin-with-chatgpt`),
    new Response('{', {headers: {'Content-Type': 'application/json'}}),
    json(null), json([]), json({success: true, reference: 'FV-A1B2C3D4', excess: 'a'.repeat(17000)}),
  ]) {
    const app = setup(upstream);
    const response = await app.submitRsvp(request());
    assert.equal(response.status, 503);
    assert.equal((await response.json()).success, undefined);
    assert.equal(response.headers.get('location'), null);
  }
});

test('only a committed success with the matching RSVP reference counts as saved', async () => {
  for (const [body, status] of [
    [{success: false, reference: 'FV-A1B2C3D4'}, 200],
    [{success: true}, 201], [{success: true, reference: 'FV-FFFFFFFF'}, 201],
    [{success: true, reference: 'not-a-reference'}, 201],
    [{success: true, reference: 'FV-A1B2C3D4'}, 500],
    [{success: true, reference: 'FV-A1B2C3D4'}, 202],
  ]) {
    const response = await setup(json(body, status)).submitRsvp(request());
    assert.equal(response.status, 503);
    assert.equal((await response.json()).success, undefined);
  }
});

test('retrying a lost upstream confirmation preserves the response ID and payload', async () => {
  const app = setup((_url, _options, count) => {
    if (count === 1) throw new Error('Connection lost after save');
    return json({success: true, reference: 'FV-A1B2C3D4'}, 200);
  });
  assert.equal((await app.submitRsvp(request())).status, 503);
  const retried = await app.submitRsvp(request());
  assert.equal(retried.status, 200);
  assert.deepEqual(await retried.json(), {success: true, reference: 'FV-A1B2C3D4'});
  assert.equal(app.requests[0].options.body, app.requests[1].options.body);
  assert.equal(JSON.parse(app.requests[1].options.body).id, id);
});

test('validation errors and conflicts retain useful status without exposing upstream extras', async () => {
  const invalid = setup(json({error: 'private driver details', fieldErrors: {email: 'Enter a valid email address.', unexpected: 'private'}, rows: [reply]}, 400));
  const response = await invalid.submitRsvp(request());
  assert.equal(response.status, 400);
  assert.deepEqual((await response.json()).fieldErrors, {email: 'Enter a valid email address.'});
  const conflict = await setup(json({error: 'private', success: true, rows: [reply]}, 409)).submitRsvp(request());
  assert.equal(conflict.status, 409);
  const body = await conflict.json();
  assert.equal(body.code, 'response_conflict');
  assert.equal(body.success, undefined);
  assert.equal(body.rows, undefined);
  assert.ok(!body.error.includes('private'));
});

test('native forms return to the Vercel confirmation page only after a confirmed save', async () => {
  const app = setup(json({success: true, reference: 'FV-A1B2C3D4'}, 201));
  const response = await app.submitRsvp(request(reply, {}, true));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), 'https://fvsignature.com/thanks?kind=rsvp&ref=FV-A1B2C3D4');
  assert.equal(JSON.parse(app.requests[0].options.body).id, id);

  const failed = await setup(new Response('<h1>Sign in</h1>')).submitRsvp(request(reply, {}, true));
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get('location'), null);
  const html = await failed.text();
  assert.match(html, /could not confirm your RSVP was saved/);
  assert.ok(!html.includes(reply.email));
});

test('native wish forms receive an ID and JSON wishes retain their retry ID', async () => {
  const app = setup(json({success: true}, 201));
  const wish = {name: 'Taylor Guest', message: 'Wishing you a wonderful wedding day!'};
  const native = await app.submitWish(request(wish, {}, true, 'wishes'));
  assert.equal(native.status, 303);
  assert.equal(native.headers.get('location'), 'https://fvsignature.com/thanks?kind=wish');
  const generated = JSON.parse(app.requests[0].options.body).id;
  assert.match(generated, /^[a-f0-9-]{36}$/);
  const saved = await app.submitWish(request({...wish, id: generated}, {}, false, 'wishes'));
  assert.equal(saved.status, 201);
  assert.deepEqual(await saved.json(), {success: true});
  assert.equal(JSON.parse(app.requests[1].options.body).id, generated);
  assert.equal(app.requests[1].url, `${weddingBackendOrigin}/api/wishes`);
});

test('availability exposes only a Boolean and fails closed until the backend is public and ready', async () => {
  for (const response of [json({available: false}), json({available: true}, 503), new Response('<h1>Sign in</h1>')]) {
    const actual = await setup(response).getRsvpAvailability();
    assert.equal(actual.status, 503);
    assert.deepEqual(await actual.json(), {available: false});
  }
  const app = setup(json({available: true, records: [reply]}));
  assert.deepEqual(await (await app.getRsvpAvailability()).json(), {available: true});
  assert.equal(app.requests[0].url, `${weddingBackendOrigin}/api/rsvp`);
  assert.deepEqual(app.requests[0].options.headers, {'Accept': 'application/json'});
});

test('network timeouts fail closed and abort the upstream request', async () => {
  let aborted = false;
  const app = createPublicBackendClient({timeoutMs: 5, fetch: (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {aborted = true; reject(new Error('private upstream details'));}, {once: true});
  })});
  const response = await app.submitRsvp(request());
  assert.equal(response.status, 503);
  assert.equal(aborted, true);
  assert.ok(!(await response.text()).includes('private upstream details'));
});

test('public event parsing selects only valid event fields and falls back on invalid upstream content', async () => {
  const app = setup(json({event: {...event, privateRecords: [reply]}}));
  assert.deepEqual(await app.getEvent(), event);
  assert.equal(app.requests[0].url, `${weddingBackendOrigin}/api/event`);
  for (const response of [
    new Response('<h1>Sign in</h1>'), json({event}, 503), json({event: {...event, time: '25:00'}}),
    json({event: {...event, date: '2026-02-30'}}), json({event: {...event, timezone: 'Unknown/Place'}}),
    json({event: {...event, venue: 'a'.repeat(201)}}), json({event: {...event, note: 12}}),
  ]) assert.equal(await setup(response).getEvent(), null);
});
