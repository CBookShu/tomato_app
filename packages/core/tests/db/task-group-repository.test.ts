import { TaskGroupRepository } from '../../src/db/task-group-repository.js';
import { setupTestDb } from './helpers.js';
import { generateId } from '../../src/utils/id-generator.js';
import { TaskGroup } from '../../src/types/task.js';

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

describe('TaskGroupRepository', () => {
  let db: ReturnType<typeof setupTestDb>;
  let repo: TaskGroupRepository;

  beforeEach(() => {
    db = setupTestDb();
    repo = new TaskGroupRepository(db);
  });

  test('create inserts a new group', async () => {
    const group = makeGroup();
    const created = await repo.create(group);
    expect(created.id).toBe(group.id);
    expect(created.name).toBe(group.name);
  });

  test('findById returns a group by id', async () => {
    const group = makeGroup();
    await repo.create(group);
    const found = await repo.findById(group.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe(group.name);
  });

  test('findById returns null for missing group', async () => {
    const found = await repo.findById('nonexistent');
    expect(found).toBeNull();
  });

  test('findAll returns all groups', async () => {
    await repo.create(makeGroup({ name: 'Group 1' }));
    await repo.create(makeGroup({ name: 'Group 2' }));
    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  test('update modifies group fields', async () => {
    const group = makeGroup();
    await repo.create(group);
    const updated = await repo.update(group.id, { name: 'Renamed', color: '#FF0000' });
    expect(updated.name).toBe('Renamed');
    expect(updated.color).toBe('#FF0000');
  });

  test('update throws for missing group', async () => {
    await expect(repo.update('nonexistent', { name: 'X' })).rejects.toThrow();
  });

  test('delete removes a group', async () => {
    const group = makeGroup();
    await repo.create(group);
    await repo.delete(group.id);
    const found = await repo.findById(group.id);
    expect(found).toBeNull();
  });

  test('taskOrder is persisted as JSON array', async () => {
    const group = makeGroup({ taskOrder: ['t1', 't2', 't3'] });
    await repo.create(group);
    const found = await repo.findById(group.id);
    expect(found!.taskOrder).toEqual(['t1', 't2', 't3']);
  });
});
