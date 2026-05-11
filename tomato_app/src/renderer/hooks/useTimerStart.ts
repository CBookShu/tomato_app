import { useCallback } from 'react';
import { useTimerStore } from '@/stores/timer-store.js';
import { useTaskStore } from '@/stores/task-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useIpc } from './useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import { readSetting } from '@/lib/settings-keys.js';

/**
 * 只提供 start 函数，不注册 IPC 监听器
 * 用于列表项等组件，避免重复注册监听器
 */
export function useTimerStart() {
  const { invoke } = useIpc();
  const store = useTimerStore();
  const settings = useSettingsStore((s) => s.settings);

  const getPomodoroDuration = useCallback(() => {
    const duration = parseInt(readSetting(settings, 'pomodoroDuration', '25'), 10);
    return (Number.isNaN(duration) ? 25 : duration) * 60;
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
      const task = useTaskStore.getState().tasks.find(t => t.id === taskId);
      if (task) {
        window.electronAPI.invoke(IPC.TIMER_TASK_TITLE, task.title);
      }
    } else {
      window.electronAPI.invoke(IPC.TIMER_TASK_TITLE, null);
    }
  }, [store, getPomodoroDuration, invoke]);

  return { start };
}
