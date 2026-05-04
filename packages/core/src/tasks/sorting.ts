import { TaskGroup } from '../types/task.js';

export function addTaskAtPosition(
  group: TaskGroup,
  taskId: string,
  referenceTaskId?: string,
  insertAfter: boolean = true,
): TaskGroup {
  const newOrder = [...group.taskOrder];

  if (!referenceTaskId) {
    newOrder.push(taskId);
  } else {
    const refIndex = newOrder.indexOf(referenceTaskId);
    if (refIndex === -1) {
      newOrder.push(taskId);
    } else {
      const insertIndex = insertAfter ? refIndex + 1 : refIndex;
      newOrder.splice(insertIndex, 0, taskId);
    }
  }

  return { ...group, taskOrder: newOrder, updatedAt: new Date().toISOString() };
}

export function reorderTasks(
  group: TaskGroup,
  taskId: string,
  newIndex: number,
): TaskGroup {
  const newOrder = [...group.taskOrder];
  const oldIndex = newOrder.indexOf(taskId);

  if (oldIndex !== -1) {
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, taskId);
  }

  return { ...group, taskOrder: newOrder, updatedAt: new Date().toISOString() };
}

export function removeTaskFromOrder(group: TaskGroup, taskId: string): TaskGroup {
  const newOrder = group.taskOrder.filter((id) => id !== taskId);
  if (newOrder.length === group.taskOrder.length) return group;
  return { ...group, taskOrder: newOrder, updatedAt: new Date().toISOString() };
}
