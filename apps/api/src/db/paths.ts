import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function resolveDatabasePath(): string {
  const configured = process.env['DATABASE_PATH'];
  if (configured && configured.length > 0) {
    return path.resolve(configured);
  }
  return path.resolve(process.cwd(), 'data', 'demo.sqlite');
}

export function schemaSqlPath(): string {
  return path.join(moduleDir, 'schema.sql');
}
