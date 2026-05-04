import { describe, test, expect, beforeEach } from 'vitest';
import { useTimerStore } from '../../src/renderer/stores/timer-store.js';

describe('timerStore', () => {
  beforeEach(() => {
    useTimerStore.setState({
      status: 'idle',
      remainingTime: 0,
      currentCycle: 0,
      currentTaskId: undefined,
    });
  });

  test('initial state is idle', () => {
    const state = useTimerStore.getState();
    expect(state.status).toBe('idle');
    expect(state.remainingTime).toBe(0);
    expect(state.currentCycle).toBe(0);
  });

  test('setState updates timer state from IPC', () => {
    useTimerStore.getState().setState({
      status: 'working',
      remainingTime: 1500,
      currentCycle: 1,
      currentTaskId: 't1',
    });
    const state = useTimerStore.getState();
    expect(state.status).toBe('working');
    expect(state.remainingTime).toBe(1500);
  });

  test('tick decrements remainingTime by 1', () => {
    useTimerStore.setState({ status: 'working', remainingTime: 100, currentCycle: 1 });
    useTimerStore.getState().tick(99);
    expect(useTimerStore.getState().remainingTime).toBe(99);
  });

  test('formatTime returns mm:ss', () => {
    useTimerStore.setState({ remainingTime: 125 });
    expect(useTimerStore.getState().formattedTime()).toBe('02:05');
  });
});
