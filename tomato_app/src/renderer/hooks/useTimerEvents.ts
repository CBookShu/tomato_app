import { useEffect } from 'react';
import { useTimerStore } from '@/stores/timer-store.js';
import { useTaskStore } from '@/stores/task-store.js';
import { useIpc } from './useIpc.js';
import { useStatsRefresh } from './useStatsRefresh.js';
import { IPC } from '@shared/ipc-channels.js';
import type { TimerState } from '@pomodoro/core';

/**
 * 全局计时器事件监听器
 * 必须在 App.tsx 中调用，确保 IPC 监听器始终存在
 */
export function useTimerEvents() {
  const { invoke, listen } = useIpc();
  const timerStore = useTimerStore();
  const taskStore = useTaskStore();
  const refreshStats = useStatsRefresh();

  useEffect(() => {
    // 监听 tick 事件
    const unsubTick = listen(IPC.TIMER_TICK, (remainingTime: unknown) => {
      timerStore.tick(remainingTime as number);
    });

    // 监听状态变化事件
    const unsubStatus = listen(IPC.TIMER_STATUS_CHANGE, (status: unknown, remainingTime?: unknown, taskId?: unknown) => {
      const state: TimerState = {
        ...useTimerStore.getState(),
        status: status as TimerState['status'],
        remainingTime: (remainingTime as number) ?? useTimerStore.getState().remainingTime,
        currentTaskId: (taskId as string) ?? useTimerStore.getState().currentTaskId,
      };
      timerStore.setState(state);
    });

    // 监听番茄完成事件
    const unsubComplete = listen(IPC.TIMER_COMPLETE, async (_type: unknown) => {
      if (_type === 'work') {
        // 获取当前任务 ID 并累计番茄数
        const currentTaskId = useTimerStore.getState().currentTaskId;
        if (currentTaskId) {
          try {
            await invoke(IPC.TASK_INCREMENT_POMODORO, { id: currentTaskId });
            // 获取更新后的任务并更新本地状态
            const updatedTask = await invoke(IPC.TASK_GET, { id: currentTaskId });
            if (updatedTask) {
              taskStore.updateTask(currentTaskId, updatedTask);
            }
            await refreshStats();
          } catch (error) {
            console.error('Failed to increment pomodoro:', error);
          }
        }
        timerStore.setState({ ...useTimerStore.getState(), status: 'breaking' });
      }
    });

    const unsubTaskComplete = listen(IPC.TASK_COMPLETE_EVENT, async () => {
      try {
        await refreshStats();
      } catch (error) {
        console.error('Failed to refresh stats after task completion:', error);
      }
    });

    return () => {
      unsubTick();
      unsubStatus();
      unsubComplete();
      unsubTaskComplete();
    };
  }, []);
}
