import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useUpdateStore } from '../../src/renderer/stores/update-store.js';

const createUpdateApi = () => ({
  getStatus: vi.fn(),
  checkForUpdates: vi.fn(),
  openRelease: vi.fn(),
});

const baseSnapshot = {
  status: 'idle' as const,
  currentVersion: '0.1.0',
  latestVersion: null,
  releaseTag: null,
  releaseName: null,
  releaseUrl: null,
  releaseNotes: null,
  lastCheckedAt: null,
  error: null,
};

describe('updateStore', () => {
  const updateApi = createUpdateApi();

  beforeEach(() => {
    vi.stubGlobal('window', {
      electronAPI: {
        update: updateApi,
      },
    } as any);

    useUpdateStore.setState({
      status: 'idle',
      currentVersion: null,
      latestVersion: null,
      releaseTag: null,
      releaseName: null,
      releaseUrl: null,
      releaseNotes: null,
      lastCheckedAt: null,
      error: null,
    });

    vi.clearAllMocks();
  });

  test('getStatus hydrates the cached update snapshot', async () => {
    updateApi.getStatus.mockResolvedValue({
      ...baseSnapshot,
      status: 'up-to-date',
      latestVersion: '0.1.0',
      lastCheckedAt: '2026-05-16T08:00:00.000Z',
    });

    await useUpdateStore.getState().getStatus();

    expect(updateApi.getStatus).toHaveBeenCalledTimes(1);
    expect(useUpdateStore.getState()).toMatchObject({
      status: 'up-to-date',
      currentVersion: '0.1.0',
      latestVersion: '0.1.0',
      lastCheckedAt: '2026-05-16T08:00:00.000Z',
      error: null,
    });
  });

  test('checkForUpdates stores a newer release snapshot', async () => {
    updateApi.checkForUpdates.mockResolvedValue({
      ...baseSnapshot,
      status: 'available',
      latestVersion: '0.2.0',
      releaseTag: 'v0.2.0',
      releaseName: 'Tomato 0.2.0',
      releaseUrl: 'https://github.com/CBookShu/tomato_app/releases/tag/v0.2.0',
      releaseNotes: '## Highlights',
      lastCheckedAt: '2026-05-16T08:10:00.000Z',
    });

    await useUpdateStore.getState().checkForUpdates({ force: true });

    expect(updateApi.checkForUpdates).toHaveBeenCalledWith({ force: true });
    expect(useUpdateStore.getState()).toMatchObject({
      status: 'available',
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      releaseTag: 'v0.2.0',
      releaseName: 'Tomato 0.2.0',
      releaseUrl: 'https://github.com/CBookShu/tomato_app/releases/tag/v0.2.0',
      lastCheckedAt: '2026-05-16T08:10:00.000Z',
      error: null,
    });
  });

  test('checkForUpdates surfaces bridge failures as an error state', async () => {
    updateApi.checkForUpdates.mockRejectedValue(new Error('network down'));

    await useUpdateStore.getState().checkForUpdates();

    expect(useUpdateStore.getState()).toMatchObject({
      status: 'error',
      error: 'network down',
    });
  });

  test('openRelease delegates to the update bridge', async () => {
    updateApi.openRelease.mockResolvedValue(undefined);

    await useUpdateStore.getState().openRelease();

    expect(updateApi.openRelease).toHaveBeenCalledTimes(1);
  });
});
