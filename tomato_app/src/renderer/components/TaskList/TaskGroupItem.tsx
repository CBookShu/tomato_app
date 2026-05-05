import type { TaskGroup, Task } from '@pomodoro/core';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { TaskItem } from './TaskItem.js';
import { useTaskStore } from '@/stores/task-store.js';
import { useIpc } from '@/hooks/useIpc.js';
import { IPC } from '@shared/ipc-channels.js';

interface TaskGroupItemProps {
  group: TaskGroup;
  tasks: Task[];
}

export function TaskGroupItem({ group, tasks }: TaskGroupItemProps) {
  const collapsedGroups = useTaskStore((s) => s.collapsedGroups);
  const toggleGroupCollapse = useTaskStore((s) => s.toggleGroupCollapse);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const addTask = useTaskStore((s) => s.addTask);
  const { invoke } = useIpc();

  const isCollapsed = collapsedGroups.has(group.id);
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  const handleAddTask = async () => {
    const title = '新任务';
    const task = {
      id: crypto.randomUUID(),
      title,
      status: 'todo' as const,
      groupId: group.id,
      completedPomodoros: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic UI update
    addTask(task);

    // Persist to database
    try {
      await invoke(IPC.TASK_CREATE, {
        title,
        groupId: group.id,
      });
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  return (
    <div className="mb-1">
      <div className="w-full flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <button
          onClick={() => toggleGroupCollapse(group.id)}
          aria-expanded={!isCollapsed}
          aria-controls={`group-${group.id}`}
          className="flex items-center gap-1 flex-1"
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

        <button
          onClick={handleAddTask}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          title="新建任务"
        >
          <Plus className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </div>

      {!isCollapsed && (
        <div id={`group-${group.id}`} className="ml-4 mt-0.5">
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
