import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useSyncStore } from '../../src/renderer/stores/sync-store.js';

const createSyncApi = () => ({
  bindRepository: vi.fn(),
  unbindRepository: vi.fn(),
  getStatus: vi.fn(),
  sync: vi.fn(),
  resolveConflict: vi.fn(),
  rollback: vi.fn(),
  getDataDir: vi.fn(),
});

const baseStatus = {
  isBound: false,
  repositoryUrl: null,
  remoteLabel: null,
  remoteBranch: null,
  boundAt: null,
  updatedAt: null,
  syncStatus: 'idle' as const,
  lastSyncTime: null,
  error: null,
  conflictBranch: null,
};

describe('syncStore', () => {
  const syncApi = createSyncApi();

  beforeEach(() => {
    vi.stubGlobal('window', {
      electronAPI: {
        sync: syncApi,
      },
    } as any);

    useSyncStore.setState({
      status: 'idle',
      isBound: false,
      repositoryUrl: null,
      remoteLabel: null,
      remoteBranch: null,
      boundAt: null,
      updatedAt: null,
      lastSyncTime: null,
      error: null,
      conflictBranch: null,
      dataDir: null,
    });

    vi.clearAllMocks();
  });

  test('getStatus hydrates binding metadata and sync state', async () => {
    syncApi.getStatus.mockResolvedValue({
      ...baseStatus,
      isBound: true,
      repositoryUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
      boundAt: '2026-05-13T12:00:00.000Z',
      updatedAt: '2026-05-13T12:10:00.000Z',
      syncStatus: 'synced',
      lastSyncTime: '2026-05-13T12:10:00.000Z',
    });

    await useSyncStore.getState().getStatus();

    expect(syncApi.getStatus).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState()).toMatchObject({
      isBound: true,
      repositoryUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
      boundAt: '2026-05-13T12:00:00.000Z',
      updatedAt: '2026-05-13T12:10:00.000Z',
      status: 'synced',
      lastSyncTime: '2026-05-13T12:10:00.000Z',
    });
  });

  test('bindRepository forwards remote url and branch', async () => {
    syncApi.bindRepository.mockResolvedValue({ success: true, status: 'synced' });
    syncApi.getStatus.mockResolvedValue({
      ...baseStatus,
      isBound: true,
      repositoryUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
      boundAt: '2026-05-13T12:00:00.000Z',
      updatedAt: '2026-05-13T12:15:00.000Z',
      syncStatus: 'synced',
      lastSyncTime: '2026-05-13T12:15:00.000Z',
    });

    await useSyncStore.getState().bindRepository('https://example.com/team/tomato.git', 'main');

    expect(syncApi.bindRepository).toHaveBeenCalledWith('https://example.com/team/tomato.git', 'main');
    expect(useSyncStore.getState()).toMatchObject({
      isBound: true,
      repositoryUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
      lastSyncTime: '2026-05-13T12:15:00.000Z',
    });
  });

  test('unbindRepository clears binding state but preserves the data directory', async () => {
    useSyncStore.setState({
      isBound: true,
      repositoryUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
      boundAt: '2026-05-13T12:00:00.000Z',
      updatedAt: '2026-05-13T12:15:00.000Z',
      lastSyncTime: '2026-05-13T12:15:00.000Z',
      error: 'boom',
      conflictBranch: 'local-backup-2026-05-13',
      dataDir: '/tmp/tomato-data',
    });

    syncApi.unbindRepository.mockResolvedValue(undefined);

    await useSyncStore.getState().unbindRepository();

    expect(syncApi.unbindRepository).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState()).toMatchObject({
      isBound: false,
      repositoryUrl: null,
      remoteLabel: null,
      remoteBranch: null,
      boundAt: null,
      updatedAt: null,
      lastSyncTime: null,
      error: null,
      conflictBranch: null,
      dataDir: '/tmp/tomato-data',
    });
  });

  test('sync updates last sync time and clears conflict state on success', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-13T12:30:00.000Z'));
    syncApi.sync.mockResolvedValue({ success: true, status: 'synced' });

    await useSyncStore.getState().sync();

    expect(syncApi.sync).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState()).toMatchObject({
      status: 'synced',
      lastSyncTime: '2026-05-13T12:30:00.000Z',
      error: null,
      conflictBranch: null,
    });
    vi.useRealTimers();
  });

  test('sync records a conflict branch when the bridge reports one', async () => {
    syncApi.sync.mockResolvedValue({
      success: false,
      status: 'conflict',
      conflictBranch: 'local-backup-2026-05-13-aaaa1111',
    });

    await useSyncStore.getState().sync();

    expect(useSyncStore.getState()).toMatchObject({
      status: 'conflict',
      conflictBranch: 'local-backup-2026-05-13-aaaa1111',
      error: null,
    });
  });

  test('rollback refreshes sync state after the bridge clears conflict data', async () => {
    syncApi.rollback.mockResolvedValue(undefined);
    syncApi.getStatus.mockResolvedValue({
      ...baseStatus,
      isBound: true,
      repositoryUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
      boundAt: '2026-05-13T12:00:00.000Z',
      updatedAt: '2026-05-13T12:31:00.000Z',
      syncStatus: 'synced',
      lastSyncTime: '2026-05-13T12:31:00.000Z',
    });
    useSyncStore.setState({
      status: 'conflict',
      conflictBranch: 'local-backup-2026-05-13-aaaa1111',
      lastSyncTime: '2026-05-13T12:30:00.000Z',
      error: null,
    });

    await useSyncStore.getState().rollback();

    expect(syncApi.rollback).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState()).toMatchObject({
      status: 'synced',
      conflictBranch: null,
      isBound: true,
      repositoryUrl: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
    });
  });

  test('getDataDir stores the application data directory', async () => {
    syncApi.getDataDir.mockResolvedValue('/tmp/tomato-data');

    await useSyncStore.getState().getDataDir();

    expect(syncApi.getDataDir).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState().dataDir).toBe('/tmp/tomato-data');
  });
});
