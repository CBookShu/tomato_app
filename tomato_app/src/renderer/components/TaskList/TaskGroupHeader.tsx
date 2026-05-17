import type { TaskGroup, Task } from '@pomodoro/core';
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { useState, useRef, useEffect } from 'react';

interface TaskGroupHeaderProps {
  group: TaskGroup;
  tasks: Task[];
  collapsed: boolean;
  onToggle: () => void;
  onAddTask: () => void;
  onRename: (name: string) => Promise<void> | void;
  onDelete: () => void;
}

export function TaskGroupHeader({
  group,
  tasks,
  collapsed,
  onToggle,
  onAddTask,
  onRename,
  onDelete,
}: TaskGroupHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDefault = group.id === 'default';
  const completed = tasks.filter((t) => t.status === 'completed').length;

  useEffect(() => {
    setName(group.name);
    setRenameError(null);
  }, [group.name]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setName(group.name);
      setRenameError(null);
      setEditing(false);
      return;
    }

    try {
      setRenameError(null);
      await onRename(trimmedName);
      setEditing(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '重命名失败';
      console.error('Failed to rename group:', error);
      setRenameError(message);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50">
        <button onClick={onToggle} className="p-0.5">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {group.color && (
          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
        )}
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setRenameError(null);
            }}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setName(group.name);
                setRenameError(null);
                setEditing(false);
              }
            }}
            className="flex-1 bg-transparent border-b border-tomato px-1 text-sm font-medium outline-none"
          />
        ) : (
          <span
            className="flex-1 text-sm font-medium truncate"
            onDoubleClick={() => {
              if (!isDefault) {
                setRenameError(null);
                setEditing(true);
              }
            }}
          >
            {group.name}
          </span>
        )}
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {completed}/{tasks.length}
        </span>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onAddTask}>
          <span className="sr-only">新建任务</span>
          <Plus className="h-3.5 w-3.5" />
        </Button>
        {!isDefault && (
          <div className="relative" ref={menuRef}>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              aria-label="分组操作"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-28 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-10">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => {
                    setRenameError(null);
                    setEditing(true);
                    setMenuOpen(false);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  重命名
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => {
                    onDelete();
                    setMenuOpen(false);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {renameError && (
        <p data-testid={`task-group-rename-error-${group.id}`} className="px-2 text-sm text-red-500">
          {renameError}
        </p>
      )}
    </div>
  );
}
