import type { TaskGroup, Task } from '@pomodoro/core';
import { TaskGroupHeader } from './TaskGroupHeader.js';
import { TaskItem } from './TaskItem.js';
import { useTaskStore } from '@/stores/task-store.js';
import { useTimerStore } from '@/stores/timer-store.js';
import { useIpc } from '@/hooks/useIpc.js';
import { IPC } from '@shared/ipc-channels.js';

interface TaskGroupItemProps {
  group: TaskGroup;
  tasks: Task[];
  onRename: (name: string) => Promise<void> | void;
  onDelete: () => void;
}

export function TaskGroupItem({ group, tasks, onRename, onDelete }: TaskGroupItemProps) {
  const collapsedGroups = useTaskStore((s) => s.collapsedGroups);
  const toggleGroupCollapse = useTaskStore((s) => s.toggleGroupCollapse);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const addTask = useTaskStore((s) => s.addTask);
  const currentTaskId = useTimerStore((s) => s.currentTaskId);
  const remainingTime = useTimerStore((s) => s.remainingTime);
  const timerStatus = useTimerStore((s) => s.status);
  const { invoke } = useIpc();

  const isCollapsed = collapsedGroups.has(group.id);
  const activeTask = tasks.find((t) => t.id === currentTaskId);
  const showTimer = activeTask && timerStatus === 'working';

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
    <div className="mb-1" data-testid="task-group">
      <TaskGroupHeader
        group={group}
        tasks={tasks}
        collapsed={isCollapsed}
        onToggle={() => toggleGroupCollapse(group.id)}
        onAddTask={handleAddTask}
        onRename={onRename}
        onDelete={onDelete}
      />
      {showTimer && (
        <div className="ml-9 mb-1 flex items-center gap-1 text-xs text-tomato animate-pulse">
          <span>🍅</span>
          <span className="font-mono">
            {Math.floor(remainingTime / 60).toString().padStart(2, '0')}:
            {(remainingTime % 60).toString().padStart(2, '0')}
          </span>
        </div>
      )}

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
