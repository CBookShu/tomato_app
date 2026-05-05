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
let statsRepo: StatsRepository | null = null;
let settingsRepo: SettingsRepository | null = null;

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

  db = drizzle(sqlite);

  const taskRepo = new TaskRepository(db);
  const groupRepo = new TaskGroupRepository(db);
  taskManager = new TaskManager(taskRepo, groupRepo);
  statsRepo = new StatsRepository(db);
  settingsRepo = new SettingsRepository(db);

  return { taskManager, statsRepo, settingsRepo };
}

export function getTaskManager() {
  if (!taskManager) throw new Error('Database not initialized');
  return taskManager;
}

export function getStatsRepo() {
  if (!statsRepo) throw new Error('Database not initialized');
  return statsRepo;
}

export function getSettingsRepo() {
  if (!settingsRepo) throw new Error('Database not initialized');
  return settingsRepo;
}

export function clearDatabase() {
  if (!sqlite) return;

  sqlite.exec('DELETE FROM tasks');
  sqlite.exec('DELETE FROM task_groups');
  sqlite.exec('DELETE FROM daily_stats');
  // 保留 settings 表，但重置为默认值
}
