import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apiPackageRoot } from './package-root.js';
import { openDatabase, type SqliteDatabase } from './open.js';

/**
 * Schema apply and database open are CLI and contract-test utilities.
 * They are exported from `@tqa/api/migrate`, not from the `@tqa/api` root.
 */

export function schemaFilePath(): string {
  return join(apiPackageRoot(), 'db', 'schema.sql');
}

export function applySchema(db: SqliteDatabase): void {
  db.exec(readFileSync(schemaFilePath(), 'utf8'));
}

export { openDatabase };
