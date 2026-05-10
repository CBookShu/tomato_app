// packages/core/tests/sync/git-client.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { GitClient } from '../../src/sync/git-client.js';

describe('GitClient', () => {
  let tempDir: string;
  let git: GitClient;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tomato-git-test-'));
    git = new GitClient(tempDir);
    await git.init();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('init creates git repository', async () => {
    const gitDir = path.join(tempDir, '.git');
    const exists = await fs.access(gitDir).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  test('isRepo returns true after init', async () => {
    const result = await git.isRepo();
    expect(result).toBe(true);
  });

  test('add stages files', async () => {
    await fs.writeFile(path.join(tempDir, 'test.yaml'), 'content');
    await git.add('.');
    const status = await git.status();
    expect(status.staged).toContain('test.yaml');
  });

  test('commit creates commit', async () => {
    await fs.writeFile(path.join(tempDir, 'test.yaml'), 'content');
    await git.add('.');
    await git.commit('test commit');
    const log = await git.log();
    expect(log.latest?.message).toBe('test commit');
  });

  test('hasChanges returns true when there are changes', async () => {
    await fs.writeFile(path.join(tempDir, 'test.yaml'), 'content');
    const result = await git.hasChanges();
    expect(result).toBe(true);
  });

  test('hasChanges returns false when clean', async () => {
    const result = await git.hasChanges();
    expect(result).toBe(false);
  });

  test('createBranch creates new branch', async () => {
    // Git 需要至少有一个提交才能创建分支
    await fs.writeFile(path.join(tempDir, 'initial.yaml'), 'initial content');
    await git.add('.');
    await git.commit('initial commit');

    await git.createBranch('test-branch');
    const branches = await git.listBranches();
    expect(branches).toContain('test-branch');
  });

  test('checkout switches branch', async () => {
    // Git 需要至少有一个提交才能创建和切换分支
    await fs.writeFile(path.join(tempDir, 'initial.yaml'), 'initial content');
    await git.add('.');
    await git.commit('initial commit');

    await git.createBranch('test-branch');
    await git.checkout('test-branch');
    const current = await git.currentBranch();
    expect(current).toBe('test-branch');
  });
});
