import BetterSqlite3 from 'better-sqlite3';
import { AuthoritativeReadError } from './errors.js';

const BUSY_TIMEOUT_CAP_MS = 1000;

function isClosedDatabaseError(error: unknown): boolean {
  return error instanceof Error && error.message === 'The database connection is not open';
}

function isSqliteError(error: unknown): boolean {
  if (!(error instanceof Error) || error.name !== 'SqliteError') {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.startsWith('SQLITE_');
}

function asUnavailable(error: unknown): AuthoritativeReadError | undefined {
  if (error instanceof AuthoritativeReadError) {
    return error;
  }
  if (isSqliteError(error) || isClosedDatabaseError(error)) {
    return new AuthoritativeReadError();
  }
  return undefined;
}

/**
 * Opens the order file on a connection that cannot write.
 * A missing file, a lock, or a failed read-only pragma is an unavailable read.
 */
export function openReadonlyDatabase(
  filename: string,
  busyTimeoutMs: number,
): BetterSqlite3.Database {
  const timeout = Math.min(Math.max(busyTimeoutMs, 1), BUSY_TIMEOUT_CAP_MS);
  let db: BetterSqlite3.Database;
  try {
    db = new BetterSqlite3(filename, {
      readonly: true,
      fileMustExist: true,
    });
  } catch {
    throw new AuthoritativeReadError();
  }
  try {
    db.pragma(`busy_timeout = ${timeout}`);
    db.pragma('query_only = ON');
    const flag = db.pragma('query_only', { simple: true });
    if (Number(flag) !== 1) {
      throw new AuthoritativeReadError();
    }
  } catch (error) {
    db.close();
    throw asUnavailable(error) ?? error;
  }
  return db;
}

export function readRow(
  db: BetterSqlite3.Database,
  sql: string,
  params: readonly unknown[],
): unknown {
  try {
    return db.prepare(sql).get(...params);
  } catch (error) {
    throw asUnavailable(error) ?? error;
  }
}

export function readRows(
  db: BetterSqlite3.Database,
  sql: string,
  params: readonly unknown[],
): unknown[] {
  try {
    return db.prepare(sql).all(...params);
  } catch (error) {
    throw asUnavailable(error) ?? error;
  }
}

/**
 * Proves the connection cannot change the file.
 * A missing table is not treated as proof, because that statement never writes.
 */
export function probeReadonly(filename: string): { writesRejected: true } {
  const db = openReadonlyDatabase(filename, BUSY_TIMEOUT_CAP_MS);
  let wrote = false;
  try {
    db.pragma('user_version = 1');
    wrote = true;
  } catch (error) {
    const unavailable = asUnavailable(error);
    if (unavailable === undefined) {
      throw error;
    }
  } finally {
    db.close();
  }
  if (wrote) {
    throw new Error('Readonly connection changed user_version');
  }
  return { writesRejected: true };
}
