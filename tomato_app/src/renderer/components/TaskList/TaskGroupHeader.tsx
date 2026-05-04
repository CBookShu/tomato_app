import type { TaskGroup, Task } from '@pomodoro/core';
import { ChevronDown, ChevronRight, Plus, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { useState } from 'react';

interface TaskGroupHeaderProps {
  group: TaskGroup;
  tasks: Task[];
  collapsed: boolean;
  onToggle: () => void;
  onAddTask: () => void;
  onRename: (name: string) => void;
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
  const isDefault = group.id === 'default';
  const completed = tasks.filter((t) => t.status === 'completed').length;

  const handleSave = () => {
    if (name.trim()) {
      onRename(name.trim());
      setEditing(false);
    }
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
        <Plus className="h-3.5 w-3.5" />
      </Button>
      {!isDefault && (
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onDelete}>
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
