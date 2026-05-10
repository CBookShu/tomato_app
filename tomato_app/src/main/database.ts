import { app } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import {
  FileStorage,
  TaskFileRepository,
  GroupFileRepository,
  StatsFileRepository,
  ConfigFileRepository,
  NotesStorage,
  getStoragePaths,
} from '@pomodoro/core';
import { TaskManager } from '@pomodoro/core';

export interface StorageContext {
  storage: FileStorage;
  taskRepo: TaskFileRepository;
  groupRepo: GroupFileRepository;
  statsRepo: StatsFileRepository;
  configRepo: ConfigFileRepository;
  notesStorage: NotesStorage;
  taskManager: TaskManager;
  dataDir: string;
}

let context: StorageContext | null = null;

export async function initStorage(): Promise<StorageContext> {
  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'tomato-data');

  // Ensure directory exists
  await fs.mkdir(dataDir, { recursive: true });
  const paths = getStoragePaths(dataDir);
  await fs.mkdir(paths.meta, { recursive: true });
  await fs.mkdir(paths.groups, { recursive: true });
  await fs.mkdir(paths.tasks, { recursive: true });
  await fs.mkdir(paths.tasksNotes, { recursive: true });
  await fs.mkdir(paths.stats, { recursive: true });

  const storage = new FileStorage(dataDir);
  const taskRepo = new TaskFileRepository(storage);
  const groupRepo = new GroupFileRepository(storage);
  const statsRepo = new StatsFileRepository(storage);
  const configRepo = new ConfigFileRepository(storage);
  const notesStorage = new NotesStorage(storage);
  const taskManager = new TaskManager(taskRepo, groupRepo, statsRepo);

  context = {
    storage,
    taskRepo,
    groupRepo,
    statsRepo,
    configRepo,
    notesStorage,
    taskManager,
    dataDir,
  };

  return context;
}

export function getStorage(): StorageContext {
  if (!context) {
    throw new Error('Storage not initialized. Call initStorage() first.');
  }
  return context;
}

export function getTaskManager() {
  return getStorage().taskManager;
}

export function getTaskRepo() {
  return getStorage().taskRepo;
}

export function getGroupRepo() {
  return getStorage().groupRepo;
}

export function getStatsRepo() {
  return getStorage().statsRepo;
}

export function getConfigRepo() {
  return getStorage().configRepo;
}

export function getNotesStorage() {
  return getStorage().notesStorage;
}

export async function clearDatabase() {
  const ctx = getStorage();
  // Clear all data by re-initializing storage
  await ctx.storage.clearAll();
}

export async function clearAllData() {
  const ctx = getStorage();
  await ctx.storage.clearAll();
}
