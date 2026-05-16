import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const openExternal = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/tomato-user-data'),
    getVersion: vi.fn(() => '0.1.0'),
  },
  shell: {
    openExternal,
  },
}));

import { UpdateService } from '../../../src/main/update/update-service.js';

describe('UpdateService', () => {
  const now = new Date('2026-05-16T08:00:00.000Z');
  const tempDirs: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    openExternal.mockClear();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  test('checks GitHub Releases once, reuses the cached snapshot, and opens the release page', async () => {
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'tomato-update-'));
    tempDirs.push(cacheDir);

    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v0.2.0',
        name: 'Tomato 0.2.0',
        html_url: 'https://github.com/CBookShu/tomato_app/releases/tag/v0.2.0',
        body: '## Highlights\n- Faster startup',
      }),
    }));

    const service = new UpdateService({
      cacheDir,
      fetcher,
      openExternal,
      now: () => new Date(Date.now()),
    });

    const firstStatus = await service.getStatus();
    const firstCheck = await service.checkForUpdates();

    vi.advanceTimersByTime(60 * 60 * 1000);

    const secondCheck = await service.checkForUpdates();
    await service.openRelease();

    expect(firstStatus).toMatchObject({
      status: 'idle',
      currentVersion: '0.1.0',
      latestVersion: null,
      releaseTag: null,
      releaseName: null,
      releaseUrl: null,
      releaseNotes: null,
      error: null,
      lastCheckedAt: null,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(firstCheck).toMatchObject({
      status: 'available',
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      releaseTag: 'v0.2.0',
      releaseName: 'Tomato 0.2.0',
      releaseUrl: 'https://github.com/CBookShu/tomato_app/releases/tag/v0.2.0',
      releaseNotes: '## Highlights\n- Faster startup',
      error: null,
      lastCheckedAt: '2026-05-16T08:00:00.000Z',
    });
    expect(secondCheck).toEqual(firstCheck);
    expect(openExternal).toHaveBeenCalledWith('https://github.com/CBookShu/tomato_app/releases/tag/v0.2.0');
  });
});
