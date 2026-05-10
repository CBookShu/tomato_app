import { TaskRepository } from '../../src/db/task-repository.js';
import { TaskGroupRepository } from '../../src/db/task-group-repository.js';
import { setupTestDb } from './helpers.js';
import { generateId } from '../../src/utils/id-generator.js';
import { Task, TaskStatus, TaskGroup } from '../../src/types/task.js';

function makeTask(overrides?: Partial<Task>): Task {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: 'Test Task',
    completedPomodoros: 0,
    status: 'todo',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeGroup(overrides?: Partial<TaskGroup>): TaskGroup {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: 'Test Group',
    taskOrder: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('TaskRepository', () => {
  let db: ReturnType<typeof setupTestDb>;
  let repo: TaskRepository;
  let groupRepo: TaskGroupRepository;

  beforeEach(() => {
    db = setupTestDb();
    repo = new TaskRepository(db);
    groupRepo = new TaskGroupRepository(db);
  });

  test('create inserts a new task', async () => {
    const task = makeTask();
    const created = await repo.create(task);
    expect(created.id).toBe(task.id);
    expect(created.title).toBe(task.title);
  });

  test('findById returns a task', async () => {
    const task = makeTask();
    await repo.create(task);
    const found = await repo.findById(task.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe(task.title);
  });

  test('findById returns null for missing task', async () => {
    const found = await repo.findById('nonexistent');
    expect(found).toBeNull();
  });

  test('findAll returns all tasks', async () => {
    await repo.create(makeTask({ title: 'Task 1' }));
    await repo.create(makeTask({ title: 'Task 2' }));
    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  test('findByGroup filters by groupId', async () => {
    const groupA = makeGroup({ id: 'group-a', name: 'Group A' });
    const groupB = makeGroup({ id: 'group-b', name: 'Group B' });
    await groupRepo.create(groupA);
    await groupRepo.create(groupB);

    await repo.create(makeTask({ title: 'In Group A', groupId: 'group-a' }));
    await repo.create(makeTask({ title: 'In Group B', groupId: 'group-b' }));
    await repo.create(makeTask({ title: 'No Group' }));

    const inA = await repo.findByGroup('group-a');
    expect(inA).toHaveLength(1);
    expect(inA[0].title).toBe('In Group A');
  });

  test('update modifies task fields', async () => {
    const task = makeTask();
    await repo.create(task);
    const updated = await repo.update(task.id, {
      title: 'Updated Title',
      status: 'in-progress' as TaskStatus,
      completedPomodoros: 3,
    });
    expect(updated.title).toBe('Updated Title');
    expect(updated.status).toBe('in-progress');
    expect(updated.completedPomodoros).toBe(3);
  });

  test('update throws for missing task', async () => {
    await expect(repo.update('nonexistent', { title: 'X' })).rejects.toThrow();
  });

  test('delete removes a task', async () => {
    const task = makeTask();
    await repo.create(task);
    await repo.delete(task.id);
    const found = await repo.findById(task.id);
    expect(found).toBeNull();
  });

  test('description is stored correctly', async () => {
    const task = makeTask({ description: 'This is a test description' });
    await repo.create(task);
    const found = await repo.findById(task.id);
    expect(found!.description).toBe('This is a test description');
  });

  test('completedAt is stored correctly', async () => {
    const task = makeTask({ completedAt: '2026-05-04T10:00:00.000Z' });
    await repo.create(task);
    const found = await repo.findById(task.id);
    expect(found!.completedAt).toBe('2026-05-04T10:00:00.000Z');
  });
});
