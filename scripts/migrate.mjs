import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

// Vercel's environment takes priority; local development can use `vercel env pull`.
for (const file of ['../.env.local', '../.env']) {
  const path = fileURLToPath(new URL(file, import.meta.url));
  if (existsSync(path)) process.loadEnvFile(path);
}

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error('Migration not run: set DATABASE_URL or POSTGRES_URL to the project Neon database.');
  process.exitCode = 1;
} else {
  try {
    const sql = neon(url);
    await sql.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const applied = new Map((await sql.query('SELECT version, checksum FROM schema_migrations')).map(row => [row.version, row.checksum]));
    const directory = new URL('../migrations/', import.meta.url);
    const files = (await readdir(directory)).filter(file => /^\d+_[a-z0-9_-]+\.sql$/.test(file)).sort();
    let count = 0;
    for (const version of files) {
      const source = await readFile(new URL(version, directory), 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      if (applied.has(version)) {
        if (applied.get(version) !== checksum) throw new Error('An applied migration has changed. Restore the original migration and add a new file.');
        continue;
      }
      const statements = source.split(/^\s*-- statement-breakpoint\s*$/m).map(statement => statement.trim()).filter(Boolean);
      await sql.transaction([
        sql.query('SELECT pg_advisory_xact_lock($1, $2)', [701010, 20261010]),
        ...statements.map(statement => sql.query(statement)),
        sql.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING', [version, checksum]),
      ]);
      console.log(`Applied ${version}.`);
      count++;
    }
    console.log(count ? 'Database migration complete.' : 'Database schema is already up to date.');
  } catch (error) {
    // Do not print driver errors or connection strings containing credentials.
    const safeMessage = error instanceof Error && error.message.startsWith('An applied migration')
      ? error.message
      : 'Database migration failed. Check the configured database connection and retry.';
    console.error(safeMessage);
    process.exitCode = 1;
  }
}
