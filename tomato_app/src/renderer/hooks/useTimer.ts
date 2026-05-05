import { useEffect, useCallback } from 'react';
import { useTimerStore } from '@/stores/timer-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useIpc } from './useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { TimerState } from '@pomodoro/core';

export function useTimer() {
  const { invoke, listen } = useIpc();
  const store = useTimerStore();
  const settings = useSettingsStore((s) => s.settings);

  // Get configured pomodoro duration in seconds
  const getPomodoroDuration = useCallback(() => {
    const duration = parseInt(settings['pomodoro_duration'] || '25', 10);
    return duration * 60;
  }, [settings]);

  useEffect(() => {
    const unsubTick = listen(IPC.TIMER_TICK, (remainingTime: unknown) => {
      store.tick(remainingTime as number);
    });

    const unsubStatus = listen(IPC.TIMER_STATUS_CHANGE, (status: unknown) => {
      store.setState({ ...useTimerStore.getState(), status: status as TimerState['status'] });
    });

    const unsubComplete = listen(IPC.TIMER_COMPLETE, (_type: unknown) => {
      if (_type === 'work') {
        store.setState({ ...useTimerStore.getState(), status: 'breaking' });
      }
    });

    return () => {
      unsubTick();
      unsubStatus();
      unsubComplete();
    };
  }, []);

  const start = useCallback(async (taskId?: string) => {
    const duration = getPomodoroDuration();
    // Optimistically update UI
    store.setState({
      status: 'working',
      remainingTime: duration,
      currentCycle: store.currentCycle + 1,
      currentTaskId: taskId,
    });
    await invoke(IPC.TIMER_START, taskId ? { taskId } : {});
  }, [store, getPomodoroDuration]);

  const pause = useCallback(async () => {
    store.setState({ ...useTimerStore.getState(), status: 'paused' });
    await invoke(IPC.TIMER_PAUSE);
  }, [store]);

  const resume = useCallback(async () => {
    store.setState({ ...useTimerStore.getState(), status: 'working' });
    await invoke(IPC.TIMER_RESUME);
  }, [store]);

  const stop = useCallback(async () => {
    store.setState({ status: 'idle', remainingTime: 0, currentCycle: store.currentCycle });
    await invoke(IPC.TIMER_STOP);
  }, [store]);

  const skip = useCallback(async () => {
    await invoke(IPC.TIMER_SKIP);
  }, []);

  return { ...store, start, pause, resume, stop, skip };
}
