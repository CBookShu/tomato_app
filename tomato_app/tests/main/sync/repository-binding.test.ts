import { afterEach, describe, expect, test, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/tomato-user-data'),
  },
}));
import {
  createRepositoryBinding,
  parseRemoteBinding,
  RepositoryBindingStore,
} from '../../../src/main/sync/repository-binding.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('parseRemoteBinding', () => {
  test('accepts a remote URL and branch', () => {
    expect(parseRemoteBinding('https://example.com/team/tomato.git', 'main')).toEqual({
      remoteUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
    });
  });

  test('rejects an empty remote URL', () => {
    expect(() => parseRemoteBinding('   ', 'main')).toThrow('Remote URL is required');
  });

  test('rejects an empty remote branch', () => {
    expect(() => parseRemoteBinding('https://example.com/team/tomato.git', '  ')).toThrow(
      'Remote branch is required',
    );
  });
});

describe('RepositoryBindingStore', () => {
  test('saves, loads, and clears binding metadata', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'tomato-binding-'));
    tempDirs.push(dir);

    const store = new RepositoryBindingStore(dir);
    const binding = createRepositoryBinding('https://example.com/team/tomato.git', 'main', new Date('2026-05-13T12:00:00.000Z'));

    await store.saveBinding(binding);

    await expect(store.loadBinding()).resolves.toEqual(binding);

    await store.clearBinding();
    await expect(store.loadBinding()).resolves.toBeNull();
  });
});
