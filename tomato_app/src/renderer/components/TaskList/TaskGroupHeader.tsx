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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDefault = group.id === 'default';
  const completed = tasks.filter((t) => t.status === 'completed').length;

  useEffect(() => {
    setName(group.name);
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
      setEditing(false);
      return;
    }

    await onRename(trimmedName);
    setEditing(false);
  };

  return (
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
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="flex-1 bg-transparent border-b border-tomato px-1 text-sm font-medium outline-none"
        />
      ) : (
        <span
          className="flex-1 text-sm font-medium truncate"
          onDoubleClick={() => !isDefault && setEditing(true)}
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
  );
}
