import { describe, expect, test, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const updateStoreMock = vi.hoisted(() => ({
  state: {
    status: 'idle',
    currentVersion: null,
    latestVersion: null,
    releaseTag: null,
    releaseName: null,
    releaseUrl: null,
    releaseNotes: null,
    lastCheckedAt: null,
    error: null,
    getStatus: vi.fn(),
    checkForUpdates: vi.fn(),
    openRelease: vi.fn(),
  },
}));

vi.mock('../../src/renderer/stores/update-store.js', () => ({
  useUpdateStore: (selector: (state: typeof updateStoreMock.state) => unknown) => selector(updateStoreMock.state),
}));

import { UpdateSettings } from '../../src/renderer/components/Settings/UpdateSettings.js';

describe('UpdateSettings', () => {
  test('renders the update card fields and button label for an idle snapshot', () => {
    Object.assign(updateStoreMock.state, {
      status: 'idle',
      currentVersion: '0.1.0',
      latestVersion: null,
      releaseTag: null,
      releaseName: null,
      releaseUrl: null,
      releaseNotes: null,
      lastCheckedAt: '2026-05-16T08:00:00.000Z',
      error: null,
    });

    const markup = renderToStaticMarkup(<UpdateSettings />);

    expect(markup).toContain('当前版本');
    expect(markup).toContain('0.1.0');
    expect(markup).toContain('最新版本');
    expect(markup).toContain('尚未检查');
    expect(markup).toContain('检查状态');
    expect(markup).toContain('检查更新');
  });

  test('renders the available-release state with the open-release action', () => {
    Object.assign(updateStoreMock.state, {
      status: 'available',
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      releaseTag: 'v0.2.0',
      releaseName: 'Tomato 0.2.0',
      releaseUrl: 'https://github.com/CBookShu/tomato_app/releases/tag/v0.2.0',
      releaseNotes: '## Highlights',
      lastCheckedAt: '2026-05-16T08:10:00.000Z',
      error: null,
    });

    const markup = renderToStaticMarkup(<UpdateSettings />);

    expect(markup).toContain('发现新版本');
    expect(markup).toContain('0.2.0');
    expect(markup).toContain('v0.2.0');
    expect(markup).toContain('Tomato 0.2.0');
    expect(markup).toContain('打开发布页');
  });
});
