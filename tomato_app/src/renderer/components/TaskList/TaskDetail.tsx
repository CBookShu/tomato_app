import { useTaskStore } from '@/stores/task-store.js';
import { useTimerStart } from '@/hooks/useTimerStart.js';
import { Button } from '@/components/ui/button.js';
import { Play, CheckCircle } from 'lucide-react';
import { useMemo } from 'react';
import { useIpc } from '@/hooks/useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import { useTimerStore } from '@/stores/timer-store.js';
import { useStatsRefresh } from '@/hooks/useStatsRefresh.js';
import { MemoTaskNotesPanel } from './TaskNotesPanel.js';

export function TaskDetail() {
  const tasks = useTaskStore((s) => s.tasks);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const updateTask = useTaskStore((s) => s.updateTask);
  const { start } = useTimerStart();
  const status = useTimerStore((s) => s.status);
  const { invoke } = useIpc();
  const refreshStats = useStatsRefresh();

  // Use useMemo to find the selected task
  const task = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  if (!task) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-lg">选择一个任务查看详情</p>
          <p className="text-sm mt-1">或从左侧任务列表创建新任务</p>
        </div>
      </div>
    );
  }

  const handleStart = () => {
    start(task.id);
  };

  const handleComplete = async () => {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    const completedAt = task.status !== 'completed' ? new Date().toISOString() : undefined;

    // Optimistic UI update
    updateTask(task.id, {
      status: newStatus,
      completedAt,
    });

    // Persist to database
    try {
      if (newStatus === 'completed') {
        await invoke(IPC.TASK_COMPLETE, { id: task.id });
        await refreshStats();
      } else {
        await invoke(IPC.TASK_EDIT, {
          id: task.id,
          updates: { status: newStatus, completedAt: undefined },
        });
      }
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6 overflow-y-auto">
      <div className="flex-1 flex flex-col min-h-0 max-w-2xl">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {task.title}
          </h1>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleStart}
              disabled={status === 'working'}
            >
              <Play className="h-4 w-4 mr-1" />
              开始专注
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleComplete}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {task.status === 'completed' ? '恢复' : '完成'}
            </Button>
          </div>
        </div>

        <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <span>🍅 已完成 {task.completedPomodoros} 个番茄</span>
          <span>📅 创建于 {new Date(task.createdAt).toLocaleDateString()}</span>
        </div>

        <MemoTaskNotesPanel taskId={task.id} />
      </div>
    </div>
  );
}
