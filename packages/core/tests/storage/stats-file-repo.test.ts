// packages/core/tests/storage/stats-file-repo.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { StatsFileRepository } from '../../src/storage/stats-file-repo.js';
import { FileStorage } from '../../src/storage/file-storage.js';

describe('StatsFileRepository', () => {
  let tempDir: string;
  let storage: FileStorage;
  let repo: StatsFileRepository;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tomato-test-'));
    storage = new FileStorage(tempDir);
    repo = new StatsFileRepository(storage);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('findByDate returns stats for date', async () => {
    await repo.upsert('2026-05-10', { totalPomodoros: 5, completedTasks: 2, tasks: ['task-1'] });

    const stats = await repo.findByDate('2026-05-10');
    expect(stats).toBeTruthy();
    expect(stats?.totalPomodoros).toBe(5);
    expect(stats?.completedTasks).toBe(2);
  });

  test('findByDate returns null for missing date', async () => {
    const stats = await repo.findByDate('2026-05-10');
    expect(stats).toBeNull();
  });

  test('upsert creates new stats file', async () => {
    await repo.upsert('2026-05-10', { totalPomodoros: 3, tasks: ['task-1'] });

    const content = await storage.readFile('stats/2026-05-10.yaml');
    expect(content).toContain('totalPomodoros: 3');
  });

  test('upsert increments existing stats', async () => {
    await repo.upsert('2026-05-10', { totalPomodoros: 3, tasks: ['task-1'] });
    await repo.upsert('2026-05-10', { totalPomodoros: 2, tasks: ['task-2'] });

    const stats = await repo.findByDate('2026-05-10');
    expect(stats?.totalPomodoros).toBe(5);
    expect(stats?.tasks).toContain('task-1');
    expect(stats?.tasks).toContain('task-2');
  });

  test('findAll returns all stats', async () => {
    await repo.upsert('2026-05-10', { totalPomodoros: 1, tasks: [] });
    await repo.upsert('2026-05-11', { totalPomodoros: 2, tasks: [] });

    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });
});
