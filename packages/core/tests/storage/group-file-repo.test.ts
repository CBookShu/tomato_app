// packages/core/tests/storage/group-file-repo.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { GroupFileRepository } from '../../src/storage/group-file-repo.js';
import { FileStorage } from '../../src/storage/file-storage.js';
import { TaskGroup } from '../../src/types/task.js';

describe('GroupFileRepository', () => {
  let tempDir: string;
  let storage: FileStorage;
  let repo: GroupFileRepository;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tomato-test-'));
    storage = new FileStorage(tempDir);
    repo = new GroupFileRepository(storage);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createTestGroup = (id: string): TaskGroup => ({
    id,
    name: 'Test Group',
    color: 'blue',
    taskOrder: [],
    createdAt: '2026-05-10T10:00:00Z',
    updatedAt: '2026-05-10T10:00:00Z',
  });

  test('create writes group to file', async () => {
    const group = createTestGroup('group-123');
    await repo.create(group);

    const content = await storage.readFile('.meta/entities/groups/group-123.yaml');
    expect(content).toBeTruthy();
    expect(content).toContain('name: Test Group');
    expect(content).toContain('taskOrder: []');
  });

  test('findById returns group', async () => {
    const group = createTestGroup('group-123');
    await repo.create(group);

    const found = await repo.findById('group-123');
    expect(found).toEqual(group);
  });

  test('findById returns null for missing group', async () => {
    const found = await repo.findById('missing');
    expect(found).toBeNull();
  });

  test('findAll returns all groups', async () => {
    await repo.create(createTestGroup('group-1'));
    await repo.create(createTestGroup('group-2'));

    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  test('update modifies group and taskOrder', async () => {
    await repo.create(createTestGroup('group-123'));
    const updated = await repo.update('group-123', {
      name: 'Updated Name',
      taskOrder: ['task-1', 'task-2'],
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.taskOrder).toEqual(['task-1', 'task-2']);
  });

  test('delete removes group file', async () => {
    await repo.create(createTestGroup('group-123'));
    await repo.delete('group-123');

    const found = await repo.findById('group-123');
    expect(found).toBeNull();
  });
});
