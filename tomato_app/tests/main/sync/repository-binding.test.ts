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
  parseGitHubRepositoryUrl,
  RepositoryBindingStore,
} from '../../../src/main/sync/repository-binding.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('parseGitHubRepositoryUrl', () => {
  test('accepts a full https GitHub URL', () => {
    expect(parseGitHubRepositoryUrl('https://github.com/you/tomato-data')).toEqual({
      repositoryUrl: 'https://github.com/you/tomato-data',
      repositoryOwner: 'you',
      repositoryName: 'tomato-data',
    });
  });

  test('rejects non-GitHub URLs', () => {
    expect(() => parseGitHubRepositoryUrl('https://example.com/you/tomato-data')).toThrow(
      'Repository URL must be a full https://github.com/<owner>/<repo> URL',
    );
  });
});

describe('RepositoryBindingStore', () => {
  test('saves, loads, and clears binding metadata', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'tomato-binding-'));
    tempDirs.push(dir);

    const store = new RepositoryBindingStore(dir);
    const binding = createRepositoryBinding('https://github.com/you/tomato-data', {
      now: new Date('2026-05-13T12:00:00.000Z'),
    });

    await store.saveBinding(binding);

    await expect(store.loadBinding()).resolves.toEqual(binding);

    await store.clearBinding();
    await expect(store.loadBinding()).resolves.toBeNull();
  });
});
