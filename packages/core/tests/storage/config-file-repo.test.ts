// packages/core/tests/storage/config-file-repo.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConfigFileRepository } from '../../src/storage/config-file-repo.js';
import { FileStorage } from '../../src/storage/file-storage.js';

describe('ConfigFileRepository', () => {
  let tempDir: string;
  let storage: FileStorage;
  let repo: ConfigFileRepository;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tomato-test-'));
    storage = new FileStorage(tempDir);
    repo = new ConfigFileRepository(storage);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('get returns default config when not exists', async () => {
    const config = await repo.get();
    expect(config.pomodoroDuration).toBe(25);
    expect(config.shortBreakDuration).toBe(5);
    expect(config.longBreakDuration).toBe(15);
  });

  test('set writes config to file', async () => {
    await repo.set({ pomodoroDuration: 30 });

    const content = await storage.readFile('.meta/config.yaml');
    expect(content).toContain('pomodoroDuration: 30');
  });

  test('get returns saved config', async () => {
    await repo.set({ pomodoroDuration: 30, soundEnabled: false });

    const config = await repo.get();
    expect(config.pomodoroDuration).toBe(30);
    expect(config.soundEnabled).toBe(false);
  });

  test('set merges with existing config', async () => {
    await repo.set({ pomodoroDuration: 30 });
    await repo.set({ soundEnabled: false });

    const config = await repo.get();
    expect(config.pomodoroDuration).toBe(30);
    expect(config.soundEnabled).toBe(false);
  });
});
