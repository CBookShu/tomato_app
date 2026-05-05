import { Checkbox } from '@/components/ui/checkbox.js';
import { Button } from '@/components/ui/button.js';
import { ConfirmDialog } from '@/components/ui/confirm-dialog.js';
import { cn } from '@/lib/utils.js';
import type { Task } from '@pomodoro/core';
import { GripVertical, Pencil, Trash2, Play } from 'lucide-react';
import { useState } from 'react';
import { useTaskStore } from '@/stores/task-store.js';
import { useTimerStore } from '@/stores/timer-store.js';
import { useTimer } from '@/hooks/useTimer.js';
import { IPC } from '@shared/ipc-channels.js';

interface TaskItemProps {
  task: Task;
  isSelected?: boolean;
}

export function TaskItem({ task, isSelected }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isCompleted = task.status === 'completed';

  const { updateTask, removeTask, selectTask } = useTaskStore();
  const { start } = useTimer();
  const currentTaskId = useTimerStore((s) => s.currentTaskId);
  const isActive = task.id === currentTaskId;

  const handleCheck = () => {
    updateTask(task.id, {
      status: task.status === 'completed' ? 'todo' : 'completed',
      completedAt: task.status !== 'completed' ? new Date().toISOString() : undefined,
    });
  };

  const handleStart = () => {
    start(task.id);
  };

  const handleEdit = () => {
    if (title.trim()) {
      updateTask(task.id, { title: title.trim() });
      setEditing(false);
    }
  };

  const handleDelete = () => {
    if (isActive) {
      setShowDeleteConfirm(true);
    } else {
      removeTask(task.id);
    }
  };

  const handleConfirmDelete = async () => {
    // Stop timer first
    await window.electronAPI.invoke(IPC.TIMER_STOP);
    removeTask(task.id);
  };

  const handleClick = () => {
    selectTask(task.id);
  };

  return (
    <div
      onClick={handleClick}
      data-testid="task-item"
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer',
        isCompleted && 'opacity-50',
        isSelected && 'bg-tomato/10 dark:bg-tomato/20',
        isActive && 'bg-tomato/10 dark:bg-tomato/20',
      )}
    >
      <GripVertical className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
      <Checkbox
        checked={isCompleted}
        onCheckedChange={handleCheck}
        className="shrink-0"
      />
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="flex-1 bg-transparent border-b border-tomato px-1 text-sm outline-none"
        />
      ) : (
        <span
          className={cn('flex-1 text-sm truncate', isCompleted && 'line-through')}
          onDoubleClick={() => setEditing(true)}
        >
          {task.title}
        </span>
      )}
      {!isActive && (
        <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
          {task.completedPomodoros > 0 ? `x${task.completedPomodoros}` : ''}
        </span>
      )}
      {isActive && (
        <span data-testid="timer-indicator" className="text-sm animate-pulse shrink-0">🍅</span>
      )}
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleStart}>
          <Play className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(true)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="确认删除"
        description={`任务「${task.title}」正在专注中，删除后将停止计时。`}
        confirmLabel="确定删除"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
