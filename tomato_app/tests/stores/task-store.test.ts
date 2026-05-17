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
    useTaskStore.setState({
      tasks: [],
      groups: [],
      loading: false,
      selectedTaskId: null,
      collapsedGroups: new Set<string>(),
    });
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

  test('getTasksByGroup respects the group taskOrder when present', () => {
    useTaskStore.getState().setGroups([
      {
        ...mockGroup('g1', 'Work'),
        taskOrder: ['t2', 't1'],
      },
    ]);
    useTaskStore.getState().addTask(mockTask('t1', 'g1'));
    useTaskStore.getState().addTask(mockTask('t2', 'g1'));

    const inG1 = useTaskStore.getState().getTasksByGroup('g1');

    expect(inG1.map((task) => task.id)).toEqual(['t2', 't1']);
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

  describe('selectTask', () => {
    test('sets selectedTaskId when selecting a task', () => {
      useTaskStore.getState().addTask(mockTask('t1'));
      useTaskStore.getState().selectTask('t1');
      expect(useTaskStore.getState().selectedTaskId).toBe('t1');
    });

    test('clears selectedTaskId when passing null', () => {
      useTaskStore.getState().addTask(mockTask('t1'));
      useTaskStore.getState().selectTask('t1');
      useTaskStore.getState().selectTask(null);
      expect(useTaskStore.getState().selectedTaskId).toBeNull();
    });
  });

  describe('getSelectedTask', () => {
    test('returns null when no task is selected', () => {
      const selected = useTaskStore.getState().getSelectedTask();
      expect(selected).toBeNull();
    });

    test('returns the selected task when one is selected', () => {
      useTaskStore.getState().addTask(mockTask('t1'));
      useTaskStore.getState().selectTask('t1');
      const selected = useTaskStore.getState().getSelectedTask();
      expect(selected?.id).toBe('t1');
    });

    test('returns null when selected task does not exist', () => {
      useTaskStore.getState().selectTask('nonexistent');
      const selected = useTaskStore.getState().getSelectedTask();
      expect(selected).toBeNull();
    });
  });

  describe('toggleGroupCollapse', () => {
    test('adds group to collapsedGroups when not collapsed', () => {
      useTaskStore.getState().toggleGroupCollapse('g1');
      expect(useTaskStore.getState().collapsedGroups.has('g1')).toBe(true);
    });

    test('removes group from collapsedGroups when already collapsed', () => {
      useTaskStore.getState().toggleGroupCollapse('g1');
      useTaskStore.getState().toggleGroupCollapse('g1');
      expect(useTaskStore.getState().collapsedGroups.has('g1')).toBe(false);
    });

    test('toggles multiple groups independently', () => {
      useTaskStore.getState().toggleGroupCollapse('g1');
      useTaskStore.getState().toggleGroupCollapse('g2');
      expect(useTaskStore.getState().collapsedGroups.has('g1')).toBe(true);
      expect(useTaskStore.getState().collapsedGroups.has('g2')).toBe(true);
    });
  });
});
