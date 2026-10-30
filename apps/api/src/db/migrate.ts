import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { resolveDatabasePath, schemaSqlPath } from './paths.js';

const SCHEMA_VERSION = 1;

export function migrateDatabase(dbPath: string = resolveDatabasePath()): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const migrationsTable = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
      )
      .get() as { name: string } | undefined;

    if (migrationsTable) {
      const applied = db
        .prepare(
          'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1',
        )
        .get() as { version: number } | undefined;

      if (applied?.version === SCHEMA_VERSION) {
        return;
      }
    }

    const schemaSql = fs.readFileSync(schemaSqlPath(), 'utf8');
    db.exec(schemaSql);

    db.prepare(
      'INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
    ).run(SCHEMA_VERSION, new Date().toISOString());
  } finally {
    db.close();
  }
}

const executedPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : undefined;
const modulePath = fileURLToPath(import.meta.url);

if (executedPath === modulePath) {
  migrateDatabase();
  console.log(`SQLite migrations applied at ${resolveDatabasePath()}`);
}
