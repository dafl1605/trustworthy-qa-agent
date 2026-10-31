import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp, listen } from './app.js';
import { readDatabasePath, readPort } from './config.js';
import { applySchema, openDatabase } from './db/migrate.js';
import { log } from './log.js';

const databasePath = readDatabasePath(process.env);
mkdirSync(dirname(databasePath), { recursive: true });
const database = openDatabase(databasePath);
applySchema(database);
log('info', 'api.database_ready', { databasePath });

const port = readPort(process.env);
await listen(createApp({ database }), port);
