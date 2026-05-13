import { beforeEach, describe, expect, test, vi } from 'vitest';
import { SyncService } from '../../../src/main/sync/sync-service.js';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/tomato-user-data') },
  shell: { openExternal: vi.fn() },
  safeStorage: {
    encryptString: vi.fn((value: string) => Buffer.from(value)),
    decryptString: vi.fn((value: Buffer) => value.toString()),
  },
}));

describe('SyncService', () => {
  let storedBinding: {
    repositoryUrl: string;
    repositoryOwner: string;
    repositoryName: string;
    remoteName: 'origin';
    remoteBranch: string;
    boundAt: string;
    updatedAt: string;
  } | null;
  let storedToken: string | null;

  const bindingStore = {
    loadBinding: vi.fn(async () => storedBinding),
    saveBinding: vi.fn(async (binding) => {
      storedBinding = binding;
    }),
    clearBinding: vi.fn(async () => {
      storedBinding = null;
    }),
  };

  const tokenStore = {
    getToken: vi.fn(async () => storedToken),
    saveToken: vi.fn(async () => undefined),
    deleteToken: vi.fn(async () => {
      storedToken = null;
    }),
    hasToken: vi.fn(async () => Boolean(storedToken)),
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
    listBranches: vi.fn(async () => ['main']),
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
    storedBinding = null;
    storedToken = 'ghp_test_token';
    bindingStore.loadBinding.mockClear();
    bindingStore.saveBinding.mockClear();
    bindingStore.clearBinding.mockClear();
    tokenStore.getToken.mockClear();
    tokenStore.saveToken.mockClear();
    tokenStore.deleteToken.mockClear();
    tokenStore.hasToken.mockClear();
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

  test('bindRepository stores binding metadata and initializes an empty repository in the background', async () => {
    const service = new SyncService({
      bindingStore,
      tokenStore,
      gitFactory,
      syncManagerFactory,
      storage: {} as any,
      dataDirProvider: () => '/tmp/tomato-data',
    } as any);

    const result = await service.bindRepository('https://github.com/you/tomato-data');
    const status = await service.getStatus();

    expect(gitFactory).toHaveBeenCalledWith(
      '/tmp/tomato-data',
      expect.objectContaining({
        remoteName: 'origin',
        remoteBranch: 'main',
        env: expect.objectContaining({
          GIT_TERMINAL_PROMPT: '0',
          GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
        }),
      }),
    );
    expect(git.init).toHaveBeenCalled();
    expect(git.addRemote).toHaveBeenCalledWith('origin', 'https://github.com/you/tomato-data');
    expect(git.getRemoteDefaultBranch).toHaveBeenCalledWith('origin');
    expect(syncManager.commitChanges).toHaveBeenCalled();
    expect(syncManager.pushChanges).toHaveBeenCalled();
    expect(syncManager.sync).not.toHaveBeenCalled();
    expect(bindingStore.saveBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryUrl: 'https://github.com/you/tomato-data',
        repositoryOwner: 'you',
        repositoryName: 'tomato-data',
        remoteName: 'origin',
        remoteBranch: 'main',
      }),
    );
    expect(result).toEqual({ success: true, status: 'synced' });
    expect(status.isLoggedIn).toBe(true);
    expect(status.isBound).toBe(true);
    expect(status.repositoryOwner).toBe('you');
    expect(status.repositoryName).toBe('tomato-data');
    expect(status.remoteBranch).toBe('main');
    expect(status.syncStatus).toBe('synced');
  });

  test('bindRepository rejects repositories whose default branch is not main', async () => {
    git.getRemoteDefaultBranch.mockResolvedValueOnce('master');

    const service = new SyncService({
      bindingStore,
      tokenStore,
      gitFactory,
      syncManagerFactory,
      storage: {} as any,
      dataDirProvider: () => '/tmp/tomato-data',
    } as any);

    await expect(service.bindRepository('https://github.com/you/tomato-data')).rejects.toThrow(
      'Remote default branch must be main',
    );
    expect(bindingStore.saveBinding).not.toHaveBeenCalled();
  });

  test('unbindRepository clears binding metadata and token state', async () => {
    storedBinding = {
      repositoryUrl: 'https://github.com/you/tomato-data',
      repositoryOwner: 'you',
      repositoryName: 'tomato-data',
      remoteName: 'origin',
      remoteBranch: 'main',
      boundAt: '2026-05-13T12:00:00.000Z',
      updatedAt: '2026-05-13T12:00:00.000Z',
    };

    const service = new SyncService({
      bindingStore,
      tokenStore,
      gitFactory,
      syncManagerFactory,
      storage: {} as any,
      dataDirProvider: () => '/tmp/tomato-data',
    } as any);

    await service.unbindRepository();
    const status = await service.getStatus();

    expect(bindingStore.clearBinding).toHaveBeenCalled();
    expect(tokenStore.deleteToken).toHaveBeenCalled();
    expect(status.isLoggedIn).toBe(false);
    expect(status.isBound).toBe(false);
  });
});
