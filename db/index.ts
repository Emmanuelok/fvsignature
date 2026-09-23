import 'server-only';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

type Row = Record<string, unknown>;

/** Translate the prepared statements used by the original site, never their values. */
export function preparePostgresQuery(input: string): { sql: string; parameterCount: number } {
  const ignoreDuplicate = /^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(input);
  const source = input.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i, 'INSERT INTO').trim().replace(/;\s*$/, '');
  let sql = '';
  let parameterCount = 0;
  let returningPosition = -1;

  for (let i = 0; i < source.length;) {
    const char = source[i];
    if (char === "'" || char === '"') {
      const start = i++;
      while (i < source.length) {
        if (source[i++] === char) {
          if (source[i] === char) i++;
          else break;
        }
      }
      sql += source.slice(start, i);
    } else if (source.startsWith('--', i)) {
      const end = source.indexOf('\n', i);
      const next = end === -1 ? source.length : end + 1;
      sql += source.slice(i, next);
      i = next;
    } else if (source.startsWith('/*', i)) {
      const start = i;
      let depth = 1;
      i += 2;
      while (i < source.length && depth) {
        if (source.startsWith('/*', i)) { depth++; i += 2; }
        else if (source.startsWith('*/', i)) { depth--; i += 2; }
        else i++;
      }
      sql += source.slice(start, i);
    } else if (char === '$' && /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.test(source.slice(i))) {
      const tag = source.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)![0];
      const end = source.indexOf(tag, i + tag.length);
      const next = end === -1 ? source.length : end + tag.length;
      sql += source.slice(i, next);
      i = next;
    } else if (char === '?') {
      sql += '$' + ++parameterCount;
      i++;
    } else {
      if (/^RETURNING\b/i.test(source.slice(i)) && (i === 0 || !/[A-Za-z0-9_]/.test(source[i - 1]))) returningPosition = sql.length;
      sql += char;
      i++;
    }
  }

  if (ignoreDuplicate) {
    // These INSERTs are idempotent submissions keyed by the guest's request ID.
    sql = returningPosition < 0
      ? sql + '\nON CONFLICT DO NOTHING'
      : sql.slice(0, returningPosition) + 'ON CONFLICT DO NOTHING ' + sql.slice(returningPosition);
  }
  return { sql, parameterCount };
}

class PreparedStatement {
  private readonly sql: string;
  private readonly parameterCount: number;
  private readonly client: NeonQueryFunction<false, true>;
  private readonly parameters: unknown[];
  private readonly originalQuery: string;

  constructor(client: NeonQueryFunction<false, true>, query: string, parameters: unknown[] = []) {
    const prepared = preparePostgresQuery(query);
    this.client = client;
    this.parameters = parameters;
    this.originalQuery = query;
    this.sql = prepared.sql;
    this.parameterCount = prepared.parameterCount;
  }

  bind(...parameters: unknown[]): PreparedStatement {
    // A new statement avoids parameters leaking between simultaneous requests.
    const statement = new PreparedStatement(this.client, this.originalQuery, parameters);
    if (this.parameterCount && this.parameterCount !== parameters.length) throw new Error('Incorrect database parameter count.');
    return statement;
  }

  private async execute() {
    if (this.parameterCount && this.parameterCount !== this.parameters.length) throw new Error('Incorrect database parameter count.');
    const result = await this.client.query(this.sql, this.parameters);
    // PostgreSQL returns int8 as strings. Our epoch timestamps and counts are
    // deliberately restricted to JavaScript's exact integer range.
    const integerColumns = result.fields.filter(field => field.dataTypeID === 20).map(field => field.name);
    for (const row of result.rows) {
      for (const key of integerColumns) {
        if (row[key] === null) continue;
        const number = Number(row[key]);
        if (!Number.isSafeInteger(number)) throw new Error('Database integer exceeds the supported range.');
        row[key] = number;
      }
    }
    return result;
  }

  async first<T = Row>(): Promise<T | null> {
    return (await this.execute()).rows[0] as T ?? null;
  }

  async all<T = Row>(): Promise<{ results: T[]; success: true }> {
    return { results: (await this.execute()).rows as T[], success: true };
  }

  async run(): Promise<{ success: true; meta: { changes: number } }> {
    return { success: true, meta: { changes: (await this.execute()).rowCount ?? 0 } };
  }
}

let cached: { url: string; client: NeonQueryFunction<false, true> } | undefined;

export function getDatabase() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw Object.assign(new Error('DATABASE_URL is required for guest response storage.'), {code: 'FV_DATABASE_MISSING'});
  if (!cached || cached.url !== url) cached = { url, client: neon(url, { fullResults: true }) };
  const client = cached.client;
  return { prepare: (query: string) => new PreparedStatement(client, query) };
}
