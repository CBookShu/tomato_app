import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { access, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RepositoryBindingStore, createRepositoryBinding } from '../../../src/main/sync/repository-binding.js';
import { SyncService } from '../../../src/main/sync/sync-service.js';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/tomato-user-data') },
  safeStorage: {
    encryptString: vi.fn((value: string) => Buffer.from(value)),
    decryptString: vi.fn((value: Buffer) => value.toString()),
  },
}));

describe('SyncService', () => {
  const currentTime = new Date('2026-05-14T08:00:00.000Z');
  const tempDirs: string[] = [];

  let storedBinding: {
    remoteUrl: string;
    remoteLabel: string;
    remoteBranch: string;
    boundAt: string;
    updatedAt: string;
  } | null;

  const bindingStore = {
    loadBinding: vi.fn(async () => storedBinding),
    saveBinding: vi.fn(async (binding) => {
      storedBinding = binding;
    }),
    clearBinding: vi.fn(async () => {
      storedBinding = null;
    }),
  };

  const git = {
    init: vi.fn(async () => undefined),
    addRemote: vi.fn(async () => undefined),
    getRemoteDefaultBranch: vi.fn(async () => null),
    add: vi.fn(async () => undefined),
    commit: vi.fn(async () => undefined),
    push: vi.fn(async () => undefined),
    fetch: vi.fn(async () => undefined),
    pull: vi.fn(async () => ({ success: true, hasConflicts: false })),
    hasChanges: vi.fn(async () => false),
    resetHard: vi.fn(async () => undefined),
    createBranch: vi.fn(async () => undefined),
    checkout: vi.fn(async () => undefined),
    currentBranch: vi.fn(async () => 'main'),
    listBranches: vi.fn(async () => []),
    status: vi.fn(async () => ({ isClean: () => true, ahead: 0, behind: 0 })),
  };

  const syncManager = {
    commitChanges: vi.fn(async () => undefined),
    pushChanges: vi.fn(async () => ({ success: true, status: 'synced' as const })),
    sync: vi.fn(async () => ({ success: true, status: 'synced' as const })),
    resolveConflictAndSync: vi.fn(async () => ({ success: true, status: 'synced' as const })),
    resetToRemote: vi.fn(async () => undefined),
    getStatus: vi.fn(async () => ({ isClean: true, ahead: 0, behind: 0 })),
  };

  const gitFactory = vi.fn(() => git as any);
  const syncManagerFactory = vi.fn(() => syncManager as any);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(currentTime);

    storedBinding = null;
    bindingStore.loadBinding.mockClear();
    bindingStore.saveBinding.mockClear();
    bindingStore.clearBinding.mockClear();

    git.init.mockClear();
    git.addRemote.mockClear();
    git.getRemoteDefaultBranch.mockClear();
    git.add.mockClear();
    git.commit.mockClear();
    git.push.mockClear();
    git.fetch.mockClear();
    git.pull.mockClear();
    git.hasChanges.mockClear();
    git.resetHard.mockClear();
    git.createBranch.mockClear();
    git.checkout.mockClear();
    git.currentBranch.mockClear();
    git.listBranches.mockClear();
    git.status.mockClear();

    syncManager.commitChanges.mockClear();
    syncManager.pushChanges.mockClear();
    syncManager.sync.mockClear();
    syncManager.resolveConflictAndSync.mockClear();
    syncManager.resetToRemote.mockClear();
    syncManager.getStatus.mockClear();

    gitFactory.mockClear();
    syncManagerFactory.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  test('bindRepository stores remote URL and branch and pushes initial local state without OAuth', async () => {
    git.getRemoteDefaultBranch.mockResolvedValueOnce(null);

    const service = new SyncService({
      bindingStore,
      gitFactory,
      syncManagerFactory,
      storage: {} as any,
      dataDirProvider: () => '/tmp/tomato-data',
    } as any);

    const result = await service.bindRepository('https://example.com/team/tomato.git', 'main');
    const status = await service.getStatus();

    expect(gitFactory).toHaveBeenCalledWith(
      '/tmp/tomato-data',
      expect.objectContaining({
        remoteName: 'origin',
        remoteBranch: 'main',
        env: undefined,
      }),
    );
    expect(git.init).toHaveBeenCalledTimes(1);
    expect(git.addRemote).toHaveBeenCalledWith('origin', 'https://example.com/team/tomato.git');
    expect(git.getRemoteDefaultBranch).toHaveBeenCalledWith('origin');
    expect(git.listBranches).toHaveBeenCalledTimes(1);
    expect(git.createBranch).toHaveBeenCalledWith('main');
    expect(syncManager.commitChanges).toHaveBeenCalledWith('sync: initial repository import');
    expect(syncManager.pushChanges).toHaveBeenCalledTimes(1);
    expect(syncManager.sync).not.toHaveBeenCalled();
    expect(bindingStore.saveBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        remoteUrl: 'https://example.com/team/tomato.git',
        remoteLabel: 'https://example.com/team/tomato.git',
        remoteBranch: 'main',
        boundAt: '2026-05-14T08:00:00.000Z',
        updatedAt: '2026-05-14T08:00:00.000Z',
      }),
    );
    expect(result).toEqual({ success: true, status: 'synced' });
    expect(status).toMatchObject({
      isLoggedIn: true,
      isBound: true,
      remoteUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
      syncStatus: 'synced',
      lastSyncTime: '2026-05-14T08:00:00.000Z',
      conflictBranch: null,
    });
  });

  test('sync keeps the local branch when the remote pull reports a conflict', async () => {
    storedBinding = {
      remoteUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
      boundAt: '2026-05-14T07:50:00.000Z',
      updatedAt: '2026-05-14T07:50:00.000Z',
    };

    syncManager.sync.mockResolvedValueOnce({
      success: false,
      status: 'conflict',
      conflictBranch: 'local-backup-20260514-080000-abc12345',
    });

    const service = new SyncService({
      bindingStore,
      gitFactory,
      syncManagerFactory,
      storage: {} as any,
      dataDirProvider: () => '/tmp/tomato-data',
    } as any);

    const result = await service.sync();
    const status = await service.getStatus();

    expect(git.init).toHaveBeenCalledTimes(1);
    expect(git.addRemote).toHaveBeenCalledWith('origin', 'https://example.com/team/tomato.git');
    expect(syncManager.sync).toHaveBeenCalledTimes(1);
    expect(syncManager.resetToRemote).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      status: 'conflict',
      conflictBranch: 'local-backup-20260514-080000-abc12345',
    });
    expect(status).toMatchObject({
      syncStatus: 'conflict',
      conflictBranch: 'local-backup-20260514-080000-abc12345',
      error: null,
      remoteUrl: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
    });
  });

  test('bindRepository does not create another backup branch while the same conflict is unresolved', async () => {
    const service = new SyncService({
      bindingStore,
      gitFactory,
      syncManagerFactory,
      storage: {} as any,
      dataDirProvider: () => '/tmp/tomato-data',
    } as any);

    await service.seedTestState({
      isLoggedIn: true,
      isBound: true,
      remoteUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
      boundAt: '2026-05-14T07:50:00.000Z',
      updatedAt: '2026-05-14T07:50:00.000Z',
      syncStatus: 'conflict',
      conflictBranch: 'local-backup-20260514-080000-abc12345',
    });

    gitFactory.mockClear();
    syncManagerFactory.mockClear();
    bindingStore.saveBinding.mockClear();

    const result = await service.bindRepository('https://example.com/team/tomato.git', 'main');
    const status = await service.getStatus();

    expect(gitFactory).not.toHaveBeenCalled();
    expect(syncManagerFactory).not.toHaveBeenCalled();
    expect(bindingStore.saveBinding).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      status: 'conflict',
      conflictBranch: 'local-backup-20260514-080000-abc12345',
    });
    expect(status).toMatchObject({
      syncStatus: 'conflict',
      conflictBranch: 'local-backup-20260514-080000-abc12345',
      remoteUrl: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
    });
  });

  test('unbindRepository clears the generic binding state', async () => {
    storedBinding = {
      remoteUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
      boundAt: '2026-05-14T07:50:00.000Z',
      updatedAt: '2026-05-14T07:50:00.000Z',
    };

    const service = new SyncService({
      bindingStore,
      gitFactory,
      syncManagerFactory,
      storage: {} as any,
      dataDirProvider: () => '/tmp/tomato-data',
    } as any);

    await service.unbindRepository();
    const status = await service.getStatus();

    expect(bindingStore.clearBinding).toHaveBeenCalledTimes(1);
    expect(status).toMatchObject({
      isLoggedIn: false,
      isBound: false,
      remoteUrl: null,
      remoteLabel: null,
      remoteBranch: null,
      syncStatus: 'idle',
    });
  });

  test('getStatus restores binding metadata from tomato-data/.meta on startup', async () => {
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'tomato-sync-user-data-'));
    tempDirs.push(userDataDir);

    const bindingStore = new RepositoryBindingStore(userDataDir);
    const binding = createRepositoryBinding(
      'https://example.com/team/tomato.git',
      'main',
      new Date('2026-05-14T07:50:00.000Z'),
    );
    await bindingStore.saveBinding(binding);

    const service = new SyncService({
      bindingStore,
      gitFactory,
      syncManagerFactory,
      storage: {} as any,
      dataDirProvider: () => path.join(userDataDir, 'tomato-data'),
    } as any);

    const status = await service.getStatus();

    expect(status).toMatchObject({
      isLoggedIn: true,
      isBound: true,
      remoteUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      repositoryUrl: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
      boundAt: '2026-05-14T07:50:00.000Z',
      updatedAt: '2026-05-14T07:50:00.000Z',
      lastSyncTime: '2026-05-14T07:50:00.000Z',
      syncStatus: 'idle',
      error: null,
      conflictBranch: null,
    });
  });

  test('unbindRepository removes the persisted binding file under tomato-data/.meta', async () => {
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'tomato-sync-user-data-'));
    tempDirs.push(userDataDir);

    const bindingStore = new RepositoryBindingStore(userDataDir);
    const binding = createRepositoryBinding(
      'https://example.com/team/tomato.git',
      'main',
      new Date('2026-05-14T07:50:00.000Z'),
    );
    const bindingPath = path.join(userDataDir, 'tomato-data', '.meta', 'repository-binding.json');
    await bindingStore.saveBinding(binding);

    const service = new SyncService({
      bindingStore,
      gitFactory,
      syncManagerFactory,
      storage: {} as any,
      dataDirProvider: () => path.join(userDataDir, 'tomato-data'),
    } as any);

    await service.unbindRepository();

    await expect(access(bindingPath)).rejects.toThrow();
    await expect(bindingStore.loadBinding()).resolves.toBeNull();
  });

  test('seedTestState hydrates generic remote metadata for test flows', async () => {
    const service = new SyncService({
      bindingStore,
      gitFactory,
      syncManagerFactory,
      storage: {} as any,
      dataDirProvider: () => '/tmp/tomato-data',
    } as any);

    await service.seedTestState({
      isLoggedIn: true,
      isBound: true,
      remoteUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'example remote',
      remoteBranch: 'develop',
      boundAt: '2026-05-14T07:45:00.000Z',
      updatedAt: '2026-05-14T07:55:00.000Z',
      syncStatus: 'conflict',
      lastSyncTime: '2026-05-14T07:55:00.000Z',
      conflictBranch: 'local-backup-20260514-075500-abc12345',
    });

    const status = await service.getStatus();

    expect(bindingStore.saveBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        remoteUrl: 'https://example.com/team/tomato.git',
        remoteLabel: 'example remote',
        remoteBranch: 'develop',
      }),
    );
    expect(status).toMatchObject({
      isLoggedIn: true,
      isBound: true,
      remoteUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'example remote',
      remoteBranch: 'develop',
      syncStatus: 'conflict',
      lastSyncTime: '2026-05-14T07:55:00.000Z',
      conflictBranch: 'local-backup-20260514-075500-abc12345',
    });
  });
});
