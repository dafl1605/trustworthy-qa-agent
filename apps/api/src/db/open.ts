import BetterSqlite3 from 'better-sqlite3';

export type SqliteDatabase = BetterSqlite3.Database;

export function openDatabase(filename: string): SqliteDatabase {
  const db = new BetterSqlite3(filename);
  db.pragma('foreign_keys = ON');
  return db;
}
