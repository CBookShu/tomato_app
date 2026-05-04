import type { TaskGroup, Task } from '@pomodoro/core';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TaskItem } from './TaskItem.js';
import { useTaskStore } from '@/stores/task-store.js';

interface TaskGroupItemProps {
  group: TaskGroup;
  tasks: Task[];
}

export function TaskGroupItem({ group, tasks }: TaskGroupItemProps) {
  const collapsedGroups = useTaskStore((s) => s.collapsedGroups);
  const toggleGroupCollapse = useTaskStore((s) => s.toggleGroupCollapse);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);

  const isCollapsed = collapsedGroups.has(group.id);
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="mb-1">
      <button
        onClick={() => toggleGroupCollapse(group.id)}
        className="w-full flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
        {group.color && (
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: group.color }}
          />
        )}
        <span className="flex-1 text-sm font-medium text-left truncate">
          {group.name}
        </span>
        <span className="text-xs text-gray-400">
          {completedCount}/{tasks.length}
        </span>
      </button>

      {!isCollapsed && (
        <div className="ml-4 mt-0.5">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isSelected={selectedTaskId === task.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
