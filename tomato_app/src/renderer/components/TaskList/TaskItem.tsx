import { Checkbox } from '@/components/ui/checkbox.js';
import { Button } from '@/components/ui/button.js';
import { cn } from '@/lib/utils.js';
import type { Task } from '@pomodoro/core';
import { GripVertical, Pencil, Trash2, Play } from 'lucide-react';
import { useState } from 'react';

interface TaskItemProps {
  task: Task;
  onCheck: (id: string) => void;
  onStart: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({ task, onCheck, onStart, onEdit, onDelete }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const isCompleted = task.status === 'completed';

  const handleSave = () => {
    if (title.trim()) {
      onEdit(task.id, title.trim());
      setEditing(false);
    }
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
        isCompleted && 'opacity-50',
      )}
    >
      <GripVertical className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => onCheck(task.id)}
        className="shrink-0"
      />
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
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
      <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
        {task.completedPomodoros > 0 ? `x${task.completedPomodoros}` : ''}
      </span>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onStart(task.id)}>
          <Play className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(true)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onDelete(task.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
