import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apiPackageRoot } from './package-root.js';
import { openDatabase, type SqliteDatabase } from './open.js';

export function schemaFilePath(): string {
  return join(apiPackageRoot(), 'db', 'schema.sql');
}

export function applySchema(db: SqliteDatabase): void {
  db.exec(readFileSync(schemaFilePath(), 'utf8'));
}

export { openDatabase };
