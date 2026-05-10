// packages/core/tests/sync/sync-manager.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { SyncManager } from '../../src/sync/sync-manager.js';
import { GitClient } from '../../src/sync/git-client.js';
import { FileStorage } from '../../src/storage/file-storage.js';

describe('SyncManager', () => {
  let tempDir: string;
  let git: GitClient;
  let storage: FileStorage;
  let syncManager: SyncManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tomato-sync-test-'));
    git = new GitClient(tempDir);
    await git.init();
    storage = new FileStorage(tempDir);
    syncManager = new SyncManager(git, storage);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('commitChanges creates commit with changes', async () => {
    await storage.writeFile('test.yaml', 'content');
    await syncManager.commitChanges();

    const log = await git.log();
    expect(log.latest?.message).toContain('sync:');
  });

  test('commitChanges does nothing when no changes', async () => {
    await syncManager.commitChanges();

    const log = await git.log();
    expect(log.latest).toBeUndefined();
  });

  test('createBackupBranch creates timestamped branch', async () => {
    // Git 需要至少有一个提交才能创建分支
    await storage.writeFile('initial.yaml', 'initial content');
    await git.add('.');
    await git.commit('initial commit');

    const branchName = await syncManager.createBackupBranch();
    expect(branchName).toMatch(/^local-backup-/);

    const branches = await git.listBranches();
    expect(branches).toContain(branchName);
  });

  test('getStatus returns correct status', async () => {
    const status = await syncManager.getStatus();
    expect(status.isClean).toBe(true);
    expect(status.ahead).toBe(0);
    expect(status.behind).toBe(0);
  });

  test('getStatus returns not clean when there are changes', async () => {
    await storage.writeFile('test.yaml', 'content');

    const status = await syncManager.getStatus();
    expect(status.isClean).toBe(false);
  });

  test('pullChanges returns error when no remote configured', async () => {
    const result = await syncManager.pullChanges();
    expect(result.success).toBe(false);
    expect(result.status).toBe('error');
    expect(result.error).toBeDefined();
  });

  test('pushChanges returns error when no remote configured', async () => {
    const result = await syncManager.pushChanges();
    expect(result.success).toBe(false);
    expect(result.status).toBe('error');
  });

  test('resetToRemote returns error when no remote configured', async () => {
    // Should throw or return error when no remote
    await expect(syncManager.resetToRemote()).rejects.toThrow();
  });
});
