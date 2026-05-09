import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { TaskManager, TaskRepository, TaskGroupRepository } from '@pomodoro/core';
import { StatsRepository } from '@pomodoro/core';
import { SettingsRepository } from '@pomodoro/core';
import { app } from 'electron';
import path from 'node:path';

let db: BetterSQLite3Database | null = null;
let sqlite: Database.Database | null = null;
let taskManager: TaskManager | null = null;
let taskRepo: TaskRepository | null = null;
let groupRepo: TaskGroupRepository | null = null;
let statsRepo: StatsRepository | null = null;
let settingsRepo: SettingsRepository | null = null;

/**
 * 数据库迁移：检查并添加缺失的列
 * 用于已有数据库的升级，确保旧用户数据库包含所有新列
 */
function runMigrations(): void {
  if (!sqlite) return;

  // 迁移 1: 添加 notes 列（如果不存在）
  // 修复: SqliteError: no such column: "notes"
  try {
    const tableInfo = sqlite.prepare('PRAGMA table_info(tasks)').all() as { name: string }[];
    const columnNames = tableInfo.map((col) => col.name);

    if (!columnNames.includes('notes')) {
      sqlite.exec(`ALTER TABLE tasks ADD COLUMN notes TEXT DEFAULT ''`);
    }
  } catch (e: unknown) {
    console.error('[Migration] Failed to add notes column:', e);
  }
}

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'tomato.db');
  sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      task_order TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      notes TEXT DEFAULT '',
      completed_pomodoros INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'todo',
      group_id TEXT REFERENCES task_groups(id),
      last_pomodoro_time TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      total_pomodoros INTEGER NOT NULL DEFAULT 0,
      completed_tasks INTEGER NOT NULL DEFAULT 0,
      tasks TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // 数据库迁移：添加可能缺失的列（用于已有数据库的升级）
  runMigrations();

  db = drizzle(sqlite);

  taskRepo = new TaskRepository(db);
  groupRepo = new TaskGroupRepository(db);
  statsRepo = new StatsRepository(db);
  taskManager = new TaskManager(taskRepo, groupRepo, statsRepo);
  settingsRepo = new SettingsRepository(db);

  return { taskManager, statsRepo, settingsRepo };
}

export function getTaskManager() {
  if (!taskManager) throw new Error('Database not initialized');
  return taskManager;
}

export function getTaskRepo() {
  if (!taskRepo) throw new Error('Database not initialized');
  return taskRepo;
}

export function getGroupRepo() {
  if (!groupRepo) throw new Error('Database not initialized');
  return groupRepo;
}

export function getStatsRepo() {
  if (!statsRepo) throw new Error('Database not initialized');
  return statsRepo;
}

export function getSettingsRepo() {
  if (!settingsRepo) throw new Error('Database not initialized');
  return settingsRepo;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function getSqlite(): Database.Database {
  if (!sqlite) throw new Error('Database not initialized');
  return sqlite;
}

export function clearDatabase() {
  if (!sqlite) return;

  sqlite.exec('DELETE FROM tasks');
  sqlite.exec('DELETE FROM task_groups');
  sqlite.exec('DELETE FROM daily_stats');
  // 保留 settings 表，但重置为默认值
}

export function clearAllData() {
  if (!sqlite) return;

  sqlite.exec('DELETE FROM tasks');
  sqlite.exec('DELETE FROM task_groups');
  sqlite.exec('DELETE FROM daily_stats');
  sqlite.exec('DELETE FROM settings');
}
