import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

let db: BetterSQLite3Database | null = null;

export function getDb(dbPath?: string): BetterSQLite3Database {
  if (!db) {
    const sqlite = new Database(dbPath ?? ':memory:');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);
  }
  return db;
}

export function closeDb(): void {
  db = null;
}

export function createTestDb(): BetterSQLite3Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite);
}
