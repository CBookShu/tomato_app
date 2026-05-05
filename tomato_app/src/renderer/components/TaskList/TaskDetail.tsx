import { useTaskStore } from '@/stores/task-store.js';
import { useTimer } from '@/hooks/useTimer.js';
import { Button } from '@/components/ui/button.js';
import { Play, CheckCircle, Save } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { useIpc } from '@/hooks/useIpc.js';
import { IPC } from '@shared/ipc-channels.js';

export function TaskDetail() {
  const tasks = useTaskStore((s) => s.tasks);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const updateTask = useTaskStore((s) => s.updateTask);
  const { start, status } = useTimer();
  const { invoke } = useIpc();

  // Use useMemo to find the selected task
  const task = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  // Local state for notes editing
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync notes with selected task
  useEffect(() => {
    if (task) {
      setNotes(task.description || '');
    }
  }, [task?.id, task?.description]);

  const handleSaveNotes = async () => {
    if (!task) return;

    setIsSaving(true);
    try {
      // Optimistic UI update
      updateTask(task.id, { description: notes });

      // Persist to database
      await invoke(IPC.TASK_EDIT, {
        id: task.id,
        updates: { description: notes },
      });
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setIsSaving(false);
    }
  };

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
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              📝 笔记
            </h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSaveNotes}
              disabled={isSaving}
            >
              <Save className="h-3 w-3 mr-1" />
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="添加笔记..."
            className="w-full h-40 p-3 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-tomato/50"
          />
        </div>
      </div>
    </div>
  );
}
