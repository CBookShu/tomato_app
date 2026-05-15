// packages/core/tests/storage/task-file-repo.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { TaskFileRepository } from '../../src/storage/task-file-repo.js';
import { FileStorage } from '../../src/storage/file-storage.js';
import { Task } from '../../src/types/task.js';

describe('TaskFileRepository', () => {
  let tempDir: string;
  let storage: FileStorage;
  let repo: TaskFileRepository;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tomato-test-'));
    storage = new FileStorage(tempDir);
    repo = new TaskFileRepository(storage);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createTestTask = (id: string): Task => ({
    id,
    title: 'Test Task',
    status: 'todo',
    completedPomodoros: 0,
    groupId: 'default',
    createdAt: '2026-05-10T10:00:00Z',
    updatedAt: '2026-05-10T10:00:00Z',
  });

  test('create writes task to file', async () => {
    const task = createTestTask('task-123');
    await repo.create(task);

    const content = await storage.readFile('tasks/task-123.yaml');
    expect(content).toBeTruthy();
    expect(content).toContain('title: Test Task');
  });

  test('findById returns task', async () => {
    const task = createTestTask('task-123');
    await repo.create(task);

    const found = await repo.findById('task-123');
    expect(found).toEqual(task);
  });

  test('findById returns null for missing task', async () => {
    const found = await repo.findById('missing');
    expect(found).toBeNull();
  });

  test('findAll returns all tasks', async () => {
    await repo.create(createTestTask('task-1'));
    await repo.create(createTestTask('task-2'));

    const all = await repo.findAll();
    expect(all).toHaveLength(2);
    expect(all.map((t) => t.id)).toContain('task-1');
    expect(all.map((t) => t.id)).toContain('task-2');
  });

  test('findByGroup filters by groupId', async () => {
    await repo.create({ ...createTestTask('task-1'), groupId: 'group-a' });
    await repo.create({ ...createTestTask('task-2'), groupId: 'group-b' });

    const tasks = await repo.findByGroup('group-a');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('task-1');
  });

  test('update modifies task', async () => {
    await repo.create(createTestTask('task-123'));
    const updated = await repo.update('task-123', { title: 'Updated Title' });

    expect(updated.title).toBe('Updated Title');
    expect(updated.updatedAt).not.toBe('2026-05-10T10:00:00Z');
  });

  test('delete removes task file', async () => {
    await repo.create(createTestTask('task-123'));
    await repo.delete('task-123');

    const found = await repo.findById('task-123');
    expect(found).toBeNull();
  });

  test('ignores legacy notes field in task yaml', async () => {
    await storage.writeFile(
      'tasks/task-legacy.yaml',
      [
        'id: task-legacy',
        'title: Legacy Task',
        'status: todo',
        'completedPomodoros: 0',
        'createdAt: 2026-05-10T10:00:00Z',
        'updatedAt: 2026-05-10T10:00:00Z',
        'notes: legacy notes',
      ].join('\n'),
    );

    const found = await repo.findById('task-legacy');

    expect(found).toEqual(
      expect.objectContaining({
        id: 'task-legacy',
        title: 'Legacy Task',
      }),
    );
    expect(found).not.toHaveProperty('notes');
  });
});
