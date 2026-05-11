import { useCallback } from 'react';
import { useTimerStore } from '@/stores/timer-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useIpc } from './useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import { readSetting } from '@/lib/settings-keys.js';

/**
 * 提供计时器控制函数
 * IPC 事件监听由 useTimerEvents 处理
 */
export function useTimer() {
  const { invoke } = useIpc();
  const store = useTimerStore();
  const settings = useSettingsStore((s) => s.settings);

  // Get configured pomodoro duration in seconds
  const getPomodoroDuration = useCallback(() => {
    const duration = parseInt(readSetting(settings, 'pomodoroDuration', '25'), 10);
    return duration * 60;
  }, [settings]);

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

    // Send task title to main for tray display
    if (taskId) {
      const taskStore = await import('@/stores/task-store.js').then(m => m.useTaskStore.getState());
      const task = taskStore.tasks.find(t => t.id === taskId);
      if (task) {
        window.electronAPI.invoke(IPC.TIMER_TASK_TITLE, task.title);
      }
    } else {
      window.electronAPI.invoke(IPC.TIMER_TASK_TITLE, null);
    }
  }, [store, getPomodoroDuration, invoke]);

  const pause = useCallback(async () => {
    store.setState({ ...useTimerStore.getState(), status: 'paused' });
    await invoke(IPC.TIMER_PAUSE);
  }, [store, invoke]);

  const resume = useCallback(async () => {
    store.setState({ ...useTimerStore.getState(), status: 'working' });
    await invoke(IPC.TIMER_RESUME);
  }, [store, invoke]);

  const stop = useCallback(async () => {
    store.setState({ status: 'idle', remainingTime: 0, currentCycle: store.currentCycle, currentTaskId: undefined });
    await invoke(IPC.TIMER_STOP);
    window.electronAPI.invoke(IPC.TIMER_TASK_TITLE, null);
  }, [store, invoke]);

  const skip = useCallback(async () => {
    await invoke(IPC.TIMER_SKIP);
  }, [invoke]);

  return { ...store, start, pause, resume, stop, skip };
}
