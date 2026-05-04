import { describe, test, expect, beforeEach } from 'vitest';
import { useTaskStore } from '../../src/renderer/stores/task-store.js';

const mockTask = (id: string, groupId?: string) => ({
  id,
  title: `Task ${id}`,
  completedPomodoros: 0,
  status: 'todo' as const,
  groupId,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

const mockGroup = (id: string, name: string) => ({
  id,
  name,
  taskOrder: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

describe('taskStore', () => {
  beforeEach(() => {
    useTaskStore.setState({ tasks: [], groups: [], loading: false });
  });

  test('addTask adds a task to the list', () => {
    const task = mockTask('t1', 'g1');
    useTaskStore.getState().addTask(task);
    expect(useTaskStore.getState().tasks).toHaveLength(1);
  });

  test('updateTask modifies existing task', () => {
    useTaskStore.getState().addTask(mockTask('t1'));
    useTaskStore.getState().updateTask('t1', { title: 'Updated' });
    expect(useTaskStore.getState().tasks[0].title).toBe('Updated');
  });

  test('removeTask removes a task', () => {
    useTaskStore.getState().addTask(mockTask('t1'));
    useTaskStore.getState().removeTask('t1');
    expect(useTaskStore.getState().tasks).toHaveLength(0);
  });

  test('getTasksByGroup filters correctly', () => {
    useTaskStore.getState().addTask(mockTask('t1', 'g1'));
    useTaskStore.getState().addTask(mockTask('t2', 'g2'));
    const inG1 = useTaskStore.getState().getTasksByGroup('g1');
    expect(inG1).toHaveLength(1);
    expect(inG1[0].id).toBe('t1');
  });

  test('addGroup and getGroups', () => {
    useTaskStore.getState().addGroup(mockGroup('g1', 'Work'));
    expect(useTaskStore.getState().groups).toHaveLength(1);
    expect(useTaskStore.getState().groups[0].name).toBe('Work');
  });

  test('removeGroup deletes a group', () => {
    useTaskStore.getState().addGroup(mockGroup('g1', 'Work'));
    useTaskStore.getState().removeGroup('g1');
    expect(useTaskStore.getState().groups).toHaveLength(0);
  });
});
