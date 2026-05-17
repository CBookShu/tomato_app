import { describe, expect, test, vi } from 'vitest';
import type { Task, TaskGroup } from '@pomodoro/core';
import { IPC } from '../../src/shared/ipc-channels.js';
import {
  createGroupAndRehydrate,
  deleteGroupAndRehydrate,
  renameGroupAndRehydrate,
  rehydrateTaskData,
} from '../../src/renderer/lib/task-group-actions.js';

const makeTask = (id: string, groupId = 'default'): Task => ({
  id,
  title: `Task ${id}`,
  completedPomodoros: 0,
  status: 'todo',
  groupId,
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:00:00.000Z',
});

const makeGroup = (id: string, name: string): TaskGroup => ({
  id,
  name,
  taskOrder: [],
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:00:00.000Z',
});

describe('task group actions', () => {
  test('rehydrateTaskData reloads tasks and groups from the main process', async () => {
    const tasks = [makeTask('task-1')];
    const groups = [makeGroup('default', '未分组')];
    const invoke = vi.fn(async (channel: string) => {
      if (channel === IPC.TASK_GET_ALL) return tasks;
      if (channel === IPC.GROUP_GET_ALL) return groups;
      throw new Error(`Unexpected channel: ${channel}`);
    });
    const setTasks = vi.fn();
    const setGroups = vi.fn();

    await rehydrateTaskData({ invoke, setTasks, setGroups });

    expect(invoke).toHaveBeenNthCalledWith(1, IPC.TASK_GET_ALL);
    expect(invoke).toHaveBeenNthCalledWith(2, IPC.GROUP_GET_ALL);
    expect(setTasks).toHaveBeenCalledWith(tasks);
    expect(setGroups).toHaveBeenCalledWith(groups);
  });

  test('createGroupAndRehydrate persists through IPC and then refreshes renderer state', async () => {
    const tasks = [makeTask('task-1')];
    const groups = [makeGroup('default', '未分组'), makeGroup('group-1', '工作')];
    const invoke = vi.fn(async (channel: string, payload?: unknown) => {
      if (channel === IPC.GROUP_CREATE) {
        expect(payload).toEqual({ input: { name: '工作' } });
        return groups[1];
      }
      if (channel === IPC.TASK_GET_ALL) return tasks;
      if (channel === IPC.GROUP_GET_ALL) return groups;
      throw new Error(`Unexpected channel: ${channel}`);
    });
    const setTasks = vi.fn();
    const setGroups = vi.fn();

    await createGroupAndRehydrate({
      invoke,
      setTasks,
      setGroups,
      input: { name: '工作' },
    });

    expect(invoke).toHaveBeenNthCalledWith(1, IPC.GROUP_CREATE, { input: { name: '工作' } });
    expect(invoke).toHaveBeenNthCalledWith(2, IPC.TASK_GET_ALL);
    expect(invoke).toHaveBeenNthCalledWith(3, IPC.GROUP_GET_ALL);
    expect(setTasks).toHaveBeenCalledWith(tasks);
    expect(setGroups).toHaveBeenCalledWith(groups);
  });

  test('renameGroupAndRehydrate persists through IPC and then refreshes renderer state', async () => {
    const tasks = [makeTask('task-1')];
    const groups = [makeGroup('default', '未分组'), makeGroup('group-1', '新名称')];
    const invoke = vi.fn(async (channel: string, payload?: unknown) => {
      if (channel === IPC.GROUP_RENAME) {
        expect(payload).toEqual({ id: 'group-1', name: '新名称' });
        return groups[1];
      }
      if (channel === IPC.TASK_GET_ALL) return tasks;
      if (channel === IPC.GROUP_GET_ALL) return groups;
      throw new Error(`Unexpected channel: ${channel}`);
    });
    const setTasks = vi.fn();
    const setGroups = vi.fn();

    await renameGroupAndRehydrate({
      invoke,
      setTasks,
      setGroups,
      id: 'group-1',
      name: '新名称',
    });

    expect(invoke).toHaveBeenNthCalledWith(1, IPC.GROUP_RENAME, { id: 'group-1', name: '新名称' });
    expect(invoke).toHaveBeenNthCalledWith(2, IPC.TASK_GET_ALL);
    expect(invoke).toHaveBeenNthCalledWith(3, IPC.GROUP_GET_ALL);
    expect(setTasks).toHaveBeenCalledWith(tasks);
    expect(setGroups).toHaveBeenCalledWith(groups);
  });

  test('deleteGroupAndRehydrate persists through IPC and then refreshes renderer state', async () => {
    const tasks = [makeTask('task-1')];
    const groups = [makeGroup('default', '未分组')];
    const invoke = vi.fn(async (channel: string, payload?: unknown) => {
      if (channel === IPC.GROUP_DELETE) {
        expect(payload).toEqual({ id: 'group-1' });
        return undefined;
      }
      if (channel === IPC.TASK_GET_ALL) return tasks;
      if (channel === IPC.GROUP_GET_ALL) return groups;
      throw new Error(`Unexpected channel: ${channel}`);
    });
    const setTasks = vi.fn();
    const setGroups = vi.fn();

    await deleteGroupAndRehydrate({
      invoke,
      setTasks,
      setGroups,
      id: 'group-1',
    });

    expect(invoke).toHaveBeenNthCalledWith(1, IPC.GROUP_DELETE, { id: 'group-1' });
    expect(invoke).toHaveBeenNthCalledWith(2, IPC.TASK_GET_ALL);
    expect(invoke).toHaveBeenNthCalledWith(3, IPC.GROUP_GET_ALL);
    expect(setTasks).toHaveBeenCalledWith(tasks);
    expect(setGroups).toHaveBeenCalledWith(groups);
  });
});
