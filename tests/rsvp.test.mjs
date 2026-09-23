import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRsvpHandlers, validateRsvp} from '../lib/rsvp-service.ts';

const base = {
  id: 'a1b2c3d4000000000000000000000000',
  name: '  Taylor Guest  ',
  email: '  TAYLOR@example.com ',
  attendance: 'attending',
  guests: '3',
  children: '1',
  guestNames: '  Jordan Guest, Robin Guest (child) ',
  dietary: ' Vegetarian ',
  accessNeeds: ' Step-free access ',
  song: '',
  note: ' Looking forward to celebrating! ',
};
const fallbackId = 'b'.repeat(32);

// This is a persistence contract fake, not a connection to the production database.
// It preserves PostgreSQL's insert-on-conflict behavior and can simulate a lost
// response after an insert has committed, which is the important retry boundary.
function setup(options = {}) {
  const rows = new Map();
  const logs = [];
  const queries = [];
  let afterWriteFailure = options.afterWriteFailure;
  let counter = 0;
  const database = () => {
    if (options.databaseError) throw options.databaseError;
    return {
      prepare(query) {
        queries.push(query);
        const first = async (values = []) => {
          if (options.queryError) throw options.queryError;
          if (query.includes('WHERE FALSE')) return null;
          if (query.startsWith('INSERT INTO rsvps')) {
            const [id, name, email, attendance, guests, children, access_needs,
              guest_names, dietary, song, note, created_at] = values;
            if (rows.has(id)) return null;
            rows.set(id, {id, name, email, attendance, guests, children,
              access_needs, guest_names, dietary, song, note, created_at});
            if (afterWriteFailure) {
              const error = afterWriteFailure;
              afterWriteFailure = null;
              throw error;
            }
            return {id};
          }
          assert.match(query, /FROM rsvps WHERE id=\?/);
          return rows.get(values[0]) ?? null;
        };
        return {first: () => first(), bind: (...values) => ({first: () => first(values)})};
      },
    };
  };
  const handlers = createRsvpHandlers({
    database,
    read: async request => {
      if (options.readError) throw options.readError;
      const form = request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded') ?? false;
      return {form, body: form ? Object.fromEntries(await request.formData()) : await request.json()};
    },
    id: () => (++counter).toString(16).padStart(32, '0'),
    log: (code, requestId) => logs.push({code, requestId}),
  });
  return {...handlers, rows, logs, queries};
}

function request(body = base, {headers = {}, form = false} = {}) {
  return new Request('https://fvsignature.com/api/rsvp', {
    method: 'POST',
    headers: {
      Origin: 'https://fvsignature.com',
      'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json',
      ...headers,
    },
    body: form ? new URLSearchParams(body) : JSON.stringify(body),
  });
}

test('attending response includes children in party size and normalizes guest input', () => {
  const result = validateRsvp(base, fallbackId);
  assert.deepEqual(result.errors, {});
  assert.equal(result.data.name, 'Taylor Guest');
  assert.equal(result.data.email, 'taylor@example.com');
  assert.equal(result.data.guests, 3);
  assert.equal(result.data.children, 1);
  assert.equal(result.data.guestNames, 'Jordan Guest, Robin Guest (child)');
  assert.equal(result.data.accessNeeds, 'Step-free access');
  assert.equal(validateRsvp({...base, id: ''}, fallbackId).data.id, fallbackId);
});

test('invalid email, counts and missing party names produce specific field errors', () => {
  for (const email of ['invalid', 'one@@example.com', 'name with space@example.com']) {
    assert.ok(validateRsvp({...base, email}, fallbackId).errors.email);
  }
  for (const guests of ['0', '11', '1.5', '', true, Infinity]) {
    assert.ok(validateRsvp({...base, guests}, fallbackId).errors.guests, `guests=${guests}`);
  }
  for (const children of ['4', '-1', '0.5', '', false]) {
    assert.ok(validateRsvp({...base, children}, fallbackId).errors.children, `children=${children}`);
  }
  assert.ok(validateRsvp({...base, guestNames: ' '}, fallbackId).errors.guestNames);
  assert.ok(validateRsvp({...base, attendance: 'maybe'}, fallbackId).errors.attendance);
  assert.ok(validateRsvp({...base, website: 'spam'}, fallbackId).errors.form);
  assert.ok(validateRsvp([], fallbackId).errors.form);
});

test('a declined response discards stale attendance-only fields and saves zero guests', () => {
  const {data, errors} = validateRsvp({...base, attendance: 'declined', guests: 'invalid', children: '-1'}, fallbackId);
  assert.deepEqual(errors, {});
  assert.equal(data.guests, 0);
  assert.equal(data.children, 0);
  assert.equal(data.guestNames, '');
  assert.equal(data.dietary, '');
  assert.equal(data.accessNeeds, '');
  assert.equal(data.note, 'Looking forward to celebrating!');
});

test('malformed bodies and validation errors do not reach persistence', async () => {
  const app = setup();
  const malformed = new Request('https://fvsignature.com/api/rsvp', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{',
  });
  assert.equal((await app.POST(malformed)).status, 400);
  const invalid = await app.POST(request({...base, email: 'invalid', children: '4'}));
  assert.equal(invalid.status, 400);
  const result = await invalid.json();
  assert.ok(result.fieldErrors.email);
  assert.ok(result.fieldErrors.children);
  assert.equal(result.success, undefined);
  assert.equal(app.queries.length, 0);
});

test('cross-origin and invalid-origin requests fail before reading or saving guest data', async () => {
  const app = setup({readError: new Error('must not be read')});
  for (const headers of [
    {Origin: 'https://other.example'},
    {Origin: 'http://fvsignature.com'},
    {Origin: 'null'},
    {Origin: 'invalid-url'},
    {'Sec-Fetch-Site': 'cross-site'},
  ]) {
    const response = await app.POST(request(base, {headers}));
    assert.equal(response.status, 403);
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
  assert.equal(app.queries.length, 0);
});

test('missing storage returns 503 without success or leaking provider credentials', async () => {
  const secret = 'postgres://private:do-not-leak@database.example/wedding';
  const app = setup({databaseError: Object.assign(new Error(secret), {code: 'FV_DATABASE_MISSING'})});
  const response = await app.POST(request());
  assert.equal(response.status, 503);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const body = await response.json();
  assert.equal(body.code, 'storage_unavailable');
  assert.equal(body.success, undefined);
  assert.equal(body.reference, undefined);
  assert.match(body.requestId, /^[a-f0-9]{32}$/);
  assert.deepEqual(app.logs, [{code: 'database_not_configured', requestId: body.requestId}]);
  assert.ok(!JSON.stringify({body, logs: app.logs}).includes(secret));
  assert.equal(app.rows.size, 0);
});

test('successful persistence returns a reference and an identical retry creates no duplicate', async () => {
  const app = setup();
  const first = await app.POST(request());
  assert.equal(first.status, 201);
  assert.deepEqual(await first.json(), {success: true, reference: 'FV-A1B2C3D4'});
  assert.equal(app.rows.size, 1);
  assert.equal(app.rows.get(base.id).email, 'taylor@example.com');
  assert.equal(app.rows.get(base.id).children, 1);
  assert.equal(app.rows.get(base.id).access_needs, 'Step-free access');
  const retry = await app.POST(request({...base, email: 'taylor@example.com', name: 'Taylor Guest'}));
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), {success: true, reference: 'FV-A1B2C3D4'});
  assert.equal(app.rows.size, 1);
});

test('reusing a response ID with different details returns 409 and does not overwrite', async () => {
  const app = setup();
  assert.equal((await app.POST(request())).status, 201);
  const before = structuredClone(app.rows.get(base.id));
  const changed = await app.POST(request({...base, note: 'Changed response'}));
  assert.equal(changed.status, 409);
  const body = await changed.json();
  assert.equal(body.code, 'response_conflict');
  assert.equal(body.success, undefined);
  assert.deepEqual(app.rows.get(base.id), before);
});

test('a lost database reply after commit can be safely confirmed by retrying the same response', async () => {
  const app = setup({afterWriteFailure: Object.assign(new Error('socket interrupted'), {code: 'ETIMEDOUT'})});
  const uncertain = await app.POST(request());
  assert.equal(uncertain.status, 503);
  assert.equal((await uncertain.json()).success, undefined);
  assert.equal(app.logs[0].code, 'database_timeout');
  assert.equal(app.rows.size, 1, 'the first insert committed before the reply was lost');
  const retried = await app.POST(request());
  assert.equal(retried.status, 200);
  assert.deepEqual(await retried.json(), {success: true, reference: 'FV-A1B2C3D4'});
  assert.equal(app.rows.size, 1, 'a retry must not insert a second RSVP');
});

test('unknown database failures are logged only as a safe category', async () => {
  const app = setup({queryError: new Error('Private guest details and connection secrets')});
  assert.equal((await app.POST(request())).status, 503);
  assert.equal(app.logs[0].code, 'database_unavailable');
  assert.deepEqual(Object.keys(app.logs[0]).sort(), ['code', 'requestId']);
});

test('availability checks inspect required storage without exposing guest records', async () => {
  const app = setup();
  await app.POST(request());
  const response = await app.GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {available: true});
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(app.queries.at(-1), /WHERE FALSE$/);
  assert.equal(app.rows.size, 1);
  const unavailable = setup({queryError: Object.assign(new Error('missing column'), {code: '42703'})});
  const failure = await unavailable.GET();
  assert.equal(failure.status, 503);
  assert.deepEqual(await failure.json(), {available: false});
  assert.equal(unavailable.logs[0].code, 'column_missing');
});

test('native forms redirect to confirmation only after persistence succeeds', async () => {
  const app = setup();
  const first = await app.POST(request(base, {form: true}));
  assert.equal(first.status, 303);
  assert.equal(first.headers.get('location'), 'https://fvsignature.com/thanks?kind=rsvp&ref=FV-A1B2C3D4');
  assert.equal(app.rows.size, 1);
  assert.equal((await app.POST(request(base, {form: true}))).status, 303);
  assert.equal(app.rows.size, 1);

  const failed = setup({databaseError: new Error('private connection string')});
  const response = await failed.POST(request(base, {form: true}));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('location'), null);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text();
  assert.match(html, /could not confirm your RSVP was saved/);
  assert.ok(!html.includes(base.email));
  assert.ok(!html.includes('private connection string'));
  assert.equal(failed.rows.size, 0);
});
