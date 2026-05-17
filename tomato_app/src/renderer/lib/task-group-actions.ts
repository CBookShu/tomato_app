import type { NewTaskGroup, Task, TaskGroup } from '@pomodoro/core';
import { IPC } from '@shared/ipc-channels.js';
import type { IpcChannelMap } from '@shared/ipc-channels.js';

type Invoke = <C extends keyof IpcChannelMap>(
  channel: C,
  ...args: IpcChannelMap[C]['request'] extends void ? [] : [IpcChannelMap[C]['request']]
) => Promise<IpcChannelMap[C]['response']>;

interface TaskDataHydrator {
  invoke: Invoke;
  setTasks: (tasks: Task[]) => void;
  setGroups: (groups: TaskGroup[]) => void;
}

export async function rehydrateTaskData({
  invoke,
  setTasks,
  setGroups,
}: TaskDataHydrator): Promise<void> {
  const [tasks = [], groups = []] = await Promise.all([
    invoke(IPC.TASK_GET_ALL),
    invoke(IPC.GROUP_GET_ALL),
  ]);

  setTasks(tasks);
  setGroups(groups);
}

export async function createGroupAndRehydrate({
  input,
  ...hydrator
}: TaskDataHydrator & {
  input: NewTaskGroup;
}): Promise<void> {
  await hydrator.invoke(IPC.GROUP_CREATE, { input });
  await rehydrateTaskData(hydrator);
}

export async function renameGroupAndRehydrate({
  id,
  name,
  ...hydrator
}: TaskDataHydrator & {
  id: string;
  name: string;
}): Promise<void> {
  await hydrator.invoke(IPC.GROUP_RENAME, { id, name });
  await rehydrateTaskData(hydrator);
}

export async function deleteGroupAndRehydrate({
  id,
  ...hydrator
}: TaskDataHydrator & {
  id: string;
}): Promise<void> {
  await hydrator.invoke(IPC.GROUP_DELETE, { id });
  await rehydrateTaskData(hydrator);
}
