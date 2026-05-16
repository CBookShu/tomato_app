import { Checkbox } from '@/components/ui/checkbox.js';
import { Button } from '@/components/ui/button.js';
import { ConfirmDialog } from '@/components/ui/confirm-dialog.js';
import { cn } from '@/lib/utils.js';
import type { Task } from '@pomodoro/core';
import { GripVertical, Pencil, Trash2, Play, MoreHorizontal, CheckCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTaskStore } from '@/stores/task-store.js';
import { useTimerStore } from '@/stores/timer-store.js';
import { useTimerStart } from '@/hooks/useTimerStart.js';
import { useStatsRefresh } from '@/hooks/useStatsRefresh.js';
import { useIpc } from '@/hooks/useIpc.js';
import { IPC } from '@shared/ipc-channels.js';

interface TaskItemProps {
  task: Task;
  isSelected?: boolean;
}

export function TaskItem({ task, isSelected }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isCompleted = task.status === 'completed';

  const { updateTask, removeTask, selectTask } = useTaskStore();
  const { start } = useTimerStart();
  const { invoke } = useIpc();
  const refreshStats = useStatsRefresh();
  const currentTaskId = useTimerStore((s) => s.currentTaskId);
  const isActive = task.id === currentTaskId;

  const handleCheck = async () => {
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

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    start(task.id);
  };

  const handleEdit = async () => {
    if (!title.trim()) return;

    // Optimistic UI update
    updateTask(task.id, { title: title.trim() });
    setEditing(false);

    // Persist to database
    try {
      await invoke(IPC.TASK_EDIT, {
        id: task.id,
        updates: { title: title.trim() },
      });
    } catch (error) {
      console.error('Failed to update task title:', error);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  // 点击外部关闭菜单
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

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
          onClick={(e) => e.stopPropagation()}
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
        <span data-testid="timer-indicator" className="text-sm shrink-0">🍅</span>
      )}
      <div className="relative" ref={menuRef}>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-28 rounded-md border bg-white dark:bg-gray-800 shadow-lg z-10 py-1">
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                handleStart(e);
                setMenuOpen(false);
              }}
            >
              <Play className="h-3.5 w-3.5" />
              开始专注
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                handleCheck();
                setMenuOpen(false);
              }}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {isCompleted ? '恢复' : '完成'}
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                handleEditClick(e);
                setMenuOpen(false);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              编辑
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(e);
                setMenuOpen(false);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </button>
          </div>
        )}
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
