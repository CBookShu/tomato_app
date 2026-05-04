import { useEffect } from 'react';
import { useTimerStore } from '@/stores/timer-store.js';
import { useIpc } from './useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { TimerState } from '@pomodoro/core';

export function useTimer() {
  const { invoke, listen } = useIpc();
  const store = useTimerStore();

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

  const start = (taskId?: string) => invoke(IPC.TIMER_START, taskId ? { taskId } : {});
  const pause = () => invoke(IPC.TIMER_PAUSE);
  const resume = () => invoke(IPC.TIMER_RESUME);
  const stop = () => invoke(IPC.TIMER_STOP);
  const skip = () => invoke(IPC.TIMER_SKIP);

  return { ...store, start, pause, resume, stop, skip };
}
