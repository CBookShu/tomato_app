import { addTaskAtPosition, reorderTasks, removeTaskFromOrder } from '../../src/tasks/sorting.js';
import { TaskGroup } from '../../src/types/task.js';

function makeGroup(taskOrder: string[]): TaskGroup {
  return {
    id: 'g1',
    name: 'Test Group',
    taskOrder,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

describe('addTaskAtPosition', () => {
  test('adds to end when no reference task', () => {
    const group = makeGroup(['t1', 't2']);
    const result = addTaskAtPosition(group, 't3');
    expect(result.taskOrder).toEqual(['t1', 't2', 't3']);
  });

  test('inserts after a specific reference task', () => {
    const group = makeGroup(['t1', 't2', 't4']);
    const result = addTaskAtPosition(group, 't3', 't2', true);
    expect(result.taskOrder).toEqual(['t1', 't2', 't3', 't4']);
  });

  test('inserts before a specific reference task', () => {
    const group = makeGroup(['t1', 't3', 't4']);
    const result = addTaskAtPosition(group, 't2', 't3', false);
    expect(result.taskOrder).toEqual(['t1', 't2', 't3', 't4']);
  });

  test('adds to end when reference task not found', () => {
    const group = makeGroup(['t1', 't2']);
    const result = addTaskAtPosition(group, 't3', 't99', true);
    expect(result.taskOrder).toEqual(['t1', 't2', 't3']);
  });

  test('does not mutate original group', () => {
    const group = makeGroup(['t1', 't2']);
    addTaskAtPosition(group, 't3');
    expect(group.taskOrder).toEqual(['t1', 't2']);
  });
});

describe('reorderTasks', () => {
  test('moves task to new index', () => {
    const group = makeGroup(['t1', 't2', 't3', 't4']);
    const result = reorderTasks(group, 't4', 0);
    expect(result.taskOrder).toEqual(['t4', 't1', 't2', 't3']);
  });

  test('moves task from start to end', () => {
    const group = makeGroup(['t1', 't2', 't3']);
    const result = reorderTasks(group, 't1', 2);
    expect(result.taskOrder).toEqual(['t2', 't3', 't1']);
  });

  test('returns unchanged order if task not found', () => {
    const group = makeGroup(['t1', 't2']);
    const result = reorderTasks(group, 't99', 0);
    expect(result.taskOrder).toEqual(['t1', 't2']);
  });

  test('does not mutate original', () => {
    const group = makeGroup(['t1', 't2', 't3']);
    reorderTasks(group, 't1', 2);
    expect(group.taskOrder).toEqual(['t1', 't2', 't3']);
  });
});

describe('removeTaskFromOrder', () => {
  test('removes task id from the order array', () => {
    const group = makeGroup(['t1', 't2', 't3']);
    const result = removeTaskFromOrder(group, 't2');
    expect(result.taskOrder).toEqual(['t1', 't3']);
  });

  test('returns unchanged order if task not found', () => {
    const group = makeGroup(['t1', 't2']);
    const result = removeTaskFromOrder(group, 't99');
    expect(result.taskOrder).toEqual(['t1', 't2']);
  });

  test('does not mutate original', () => {
    const group = makeGroup(['t1', 't2']);
    removeTaskFromOrder(group, 't1');
    expect(group.taskOrder).toEqual(['t1', 't2']);
  });
});
