import { useTaskStore } from '@/stores/task-store.js';
import { useTimer } from '@/hooks/useTimer.js';
import { Button } from '@/components/ui/button.js';
import { Play, CheckCircle } from 'lucide-react';

export function TaskDetail() {
  const getSelectedTask = useTaskStore((s) => s.getSelectedTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const { start, status } = useTimer();

  const task = getSelectedTask();

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

  const handleComplete = () => {
    updateTask(task.id, {
      status: task.status === 'completed' ? 'todo' : 'completed',
      completedAt: task.status !== 'completed' ? new Date().toISOString() : undefined,
    });
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-2xl">
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

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            📝 笔记
          </h2>
          <p className="text-sm text-gray-400 italic">
            笔记功能将在 Phase 2 实现...
          </p>
        </div>
      </div>
    </div>
  );
}
