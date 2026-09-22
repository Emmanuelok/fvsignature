// Run: node --experimental-strip-types --conditions=react-server --test scripts/check-database.mjs
// The Neon HTTP transport is mocked. This never connects to a real database.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { neonConfig } from '@neondatabase/serverless';
import { getDatabase, preparePostgresQuery } from '../db/index.ts';

const previousFetch = neonConfig.fetchFunction;
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousPostgresUrl = process.env.POSTGRES_URL;
process.env.DATABASE_URL = 'postgresql://test:test@database.example.invalid/wedding';
let responder;
neonConfig.fetchFunction = async (_url, options) => {
  assert.equal(typeof responder, 'function', 'Every query must have a mock response.');
  return responder(JSON.parse(options.body));
};
after(() => {
  neonConfig.fetchFunction = previousFetch;
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  if (previousPostgresUrl === undefined) delete process.env.POSTGRES_URL;
  else process.env.POSTGRES_URL = previousPostgresUrl;
});

const result = (fields = [], rows = [], rowCount = rows.length) => Response.json({ fields, rows, rowCount, command: 'SELECT' });

test('placeholder conversion leaves quoted values and SQL comments intact', () => {
  const prepared = preparePostgresQuery("SELECT '?' AS literal, \"?\" AS column, $$?$$ AS quoted -- ?\nFROM wishes WHERE id = ? /* ? */ AND name = ?");
  assert.equal(prepared.parameterCount, 2);
  assert.equal(prepared.sql, "SELECT '?' AS literal, \"?\" AS column, $$?$$ AS quoted -- ?\nFROM wishes WHERE id = $1 /* ? */ AND name = $2");
  assert.equal(preparePostgresQuery('INSERT OR IGNORE INTO wishes (id) VALUES (?) RETURNING id;').sql, 'INSERT INTO wishes (id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id');
});

test('guest input stays in parameters and a duplicate submission reports zero changes', async () => {
  const hostileName = "O'Connor'); DROP TABLE rsvps; --";
  responder = ({ query, params }) => {
    assert.equal(query, 'INSERT INTO wishes (id, name) VALUES ($1, $2)\nON CONFLICT DO NOTHING');
    assert.deepEqual(params, ['test-id', hostileName]);
    assert.ok(!query.includes(hostileName));
    return result([], [], 0);
  };
  const saved = await getDatabase().prepare('INSERT OR IGNORE INTO wishes (id, name) VALUES (?, ?)').bind('test-id', hostileName).run();
  assert.equal(saved.meta.changes, 0);
});

test('organizer updates preserve affected row count', async () => {
  responder = ({ query, params }) => {
    assert.equal(query, 'UPDATE rsvps SET attendance=$1 WHERE id=$2');
    assert.deepEqual(params, ['declined', 'test-id']);
    return result([], [], 1);
  };
  assert.equal((await getDatabase().prepare('UPDATE rsvps SET attendance=? WHERE id=?').bind('declined', 'test-id').run()).meta.changes, 1);
});

test('timestamps and login windows return exact numbers; missing records return null', async () => {
  responder = () => result([{ name: 'created_at', dataTypeID: 20 }, { name: 'window_start', dataTypeID: 20 }], [['1791633600000', '1791633500000']]);
  assert.deepEqual(await getDatabase().prepare('SELECT created_at, window_start FROM test').first(), { created_at: 1791633600000, window_start: 1791633500000 });
  responder = () => result();
  assert.equal(await getDatabase().prepare('SELECT id FROM wishes WHERE id = ?').bind('absent').first(), null);
});

test('prepared statements do not share bound values', async () => {
  const statement = getDatabase().prepare('SELECT id FROM wishes WHERE id = ?');
  responder = ({ params }) => result([{ name: 'id', dataTypeID: 25 }], [[params[0]]]);
  const [one, two] = await Promise.all([statement.bind('one').first(), statement.bind('two').first()]);
  assert.deepEqual([one.id, two.id], ['one', 'two']);
  assert.throws(() => statement.bind('one', 'two'), /parameter count/);
});

test('unsafe integers and unavailable databases fail instead of reporting a saved response', async () => {
  responder = () => result([{ name: 'created_at', dataTypeID: 20 }], [['9007199254740993']]);
  await assert.rejects(getDatabase().prepare('SELECT created_at FROM wishes').first(), /integer exceeds/);
  responder = () => { throw new Error('Mock transport failure'); };
  await assert.rejects(getDatabase().prepare('SELECT id FROM wishes').all(), /Mock transport failure/);
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  assert.throws(getDatabase, /DATABASE_URL is required/);
});
