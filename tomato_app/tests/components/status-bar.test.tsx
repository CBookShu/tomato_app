import { describe, expect, test, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const storeState = vi.hoisted(() => ({
  timer: {
    status: 'idle',
    remainingTime: 0,
    currentTaskId: null,
    setStatus: vi.fn(),
  },
  stats: {
    today: { totalPomodoros: 3 },
  },
  task: {
    tasks: [],
    selectTask: vi.fn(),
  },
  update: {
    currentVersion: '9.9.9',
    getStatus: vi.fn(),
  },
}));

vi.mock('../../src/renderer/stores/timer-store.js', () => ({
  useTimerStore: (selector: (state: typeof storeState.timer) => unknown) => selector(storeState.timer),
}));

vi.mock('../../src/renderer/stores/stats-store.js', () => ({
  useStatsStore: (selector: (state: typeof storeState.stats) => unknown) => selector(storeState.stats),
}));

vi.mock('../../src/renderer/stores/task-store.js', () => ({
  useTaskStore: (selector: (state: typeof storeState.task) => unknown) => selector(storeState.task),
}));

vi.mock('../../src/renderer/stores/update-store.js', () => ({
  useUpdateStore: (selector: (state: typeof storeState.update) => unknown) => selector(storeState.update),
}));

import { StatusBar } from '../../src/renderer/components/Layout/StatusBar.js';

describe('StatusBar', () => {
  test('renders the app version from the update store', () => {
    const markup = renderToStaticMarkup(<StatusBar />);

    expect(markup).toContain('Tomato v9.9.9');
  });
});
