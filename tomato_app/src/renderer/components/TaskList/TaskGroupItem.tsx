import type { TaskGroup, Task } from '@pomodoro/core';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { TaskItem } from './TaskItem.js';
import { useTaskStore } from '@/stores/task-store.js';
import { useTimerStore } from '@/stores/timer-store.js';
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
  const currentTaskId = useTimerStore((s) => s.currentTaskId);
  const remainingTime = useTimerStore((s) => s.remainingTime);
  const timerStatus = useTimerStore((s) => s.status);
  const { invoke } = useIpc();

  const isCollapsed = collapsedGroups.has(group.id);
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  // Find if any task in this group is active
  const activeTask = tasks.find((t) => t.id === currentTaskId);
  const showTimer = activeTask && timerStatus === 'working';

  // Format remaining time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAddTask = async () => {
    const title = '新任务';
    try {
      const createdTask = await invoke(IPC.TASK_CREATE, {
        input: {
          title,
          groupId: group.id,
        },
      });

      addTask(createdTask);
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
          {showTimer && (
            <span className="flex items-center gap-1 text-xs text-tomato animate-pulse ml-2">
              <span>🍅</span>
              <span className="font-mono">{formatTime(remainingTime)}</span>
            </span>
          )}
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
