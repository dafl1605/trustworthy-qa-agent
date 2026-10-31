import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readDatabasePath } from '../config.js';
import { log } from '../log.js';
import { applySchema, openDatabase } from './migrate.js';

const databasePath = readDatabasePath(process.env);
mkdirSync(dirname(databasePath), { recursive: true });
const db = openDatabase(databasePath);
try {
  applySchema(db);
} finally {
  db.close();
}
log('info', 'db.schema_applied', { databasePath });
