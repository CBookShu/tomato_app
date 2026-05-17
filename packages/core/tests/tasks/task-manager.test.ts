import { TaskManager } from '../../src/tasks/task-manager.js';
import { Task, TaskGroup, ITaskRepository, ITaskGroupRepository, IStatsRepository } from '../../src/tasks/task-manager.js';
import { NewTask, NewTaskGroup, TaskStatus } from '../../src/types/task.js';
import { generateId } from '../../src/utils/id-generator.js';

class InMemoryTaskRepo implements ITaskRepository {
  private tasks = new Map<string, Task>();

  async findAll(): Promise<Task[]> { return [...this.tasks.values()]; }
  async findById(id: string): Promise<Task | null> { return this.tasks.get(id) ?? null; }
  async findByGroup(groupId: string): Promise<Task[]> {
    return [...this.tasks.values()].filter((t) => t.groupId === groupId);
  }
  async create(task: Task): Promise<Task> { this.tasks.set(task.id, task); return task; }
  async update(id: string, updates: Partial<Task>): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) throw new Error(`Task ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.tasks.set(id, updated);
    return updated;
  }
  async delete(id: string): Promise<void> { this.tasks.delete(id); }
}

class InMemoryGroupRepo implements ITaskGroupRepository {
  private groups = new Map<string, TaskGroup>();

  async findAll(): Promise<TaskGroup[]> { return [...this.groups.values()]; }
  async findById(id: string): Promise<TaskGroup | null> { return this.groups.get(id) ?? null; }
  async create(group: TaskGroup): Promise<TaskGroup> { this.groups.set(group.id, group); return group; }
  async update(id: string, updates: Partial<TaskGroup>): Promise<TaskGroup> {
    const existing = this.groups.get(id);
    if (!existing) throw new Error(`Group ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.groups.set(id, updated);
    return updated;
  }
  async delete(id: string): Promise<void> { this.groups.delete(id); }
}

class RecordingStatsRepo implements IStatsRepository {
  public records: Array<{ date: string; increment: { totalPomodoros?: number; completedTasks?: number; tasks?: string[] } }> = [];

  async upsert(date: string, increment: { totalPomodoros?: number; completedTasks?: number; tasks?: string[] }): Promise<any> {
    this.records.push({ date, increment });
    return {
      date,
      totalPomodoros: increment.totalPomodoros ?? 0,
      completedTasks: increment.completedTasks ?? 0,
      tasks: increment.tasks ?? [],
    };
  }
}

describe('TaskManager', () => {
  let taskRepo: InMemoryTaskRepo;
  let groupRepo: InMemoryGroupRepo;
  let manager: TaskManager;

  beforeEach(async () => {
    taskRepo = new InMemoryTaskRepo();
    groupRepo = new InMemoryGroupRepo();
    manager = new TaskManager(taskRepo, groupRepo);
    await manager.initialize();
  });

  test('initialize creates a default group', async () => {
    const groups = await manager.getAllGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('default');
    expect(groups[0].name).toBe('未分组');
  });

  test('createTask adds task to default group when no groupId specified', async () => {
    const task = await manager.createTask({ title: 'Test task' });
    expect(task.title).toBe('Test task');
    expect(task.status).toBe('todo');
    expect(task.completedPomodoros).toBe(0);
    expect(task.groupId).toBe('default');

    const group = await manager.getGroup('default');
    expect(group!.taskOrder).toContain(task.id);
  });

  test('createTask adds task to end of specified group', async () => {
    const group = await manager.createGroup({ name: 'Work' });
    const task1 = await manager.createTask({ title: 'Task 1', groupId: group.id });
    const task2 = await manager.createTask({ title: 'Task 2', groupId: group.id });

    const updated = await manager.getGroup(group.id);
    expect(updated!.taskOrder).toEqual([task1.id, task2.id]);
  });

  test('createTask at specific position', async () => {
    const group = await manager.createGroup({ name: 'Work' });
    const t1 = await manager.createTask({ title: 'First', groupId: group.id });
    const t2 = await manager.createTask({
      title: 'Second (inserted before first)',
      groupId: group.id,
    }, t1.id, false);

    const updated = await manager.getGroup(group.id);
    expect(updated!.taskOrder[0]).toBe(t2.id);
    expect(updated!.taskOrder[1]).toBe(t1.id);
  });

  test('editTask updates title and description', async () => {
    const task = await manager.createTask({ title: 'Original' });
    const updated = await manager.editTask(task.id, { title: 'Updated', description: 'Desc' });

    expect(updated.title).toBe('Updated');
    expect(updated.description).toBe('Desc');
    expect(updated.id).toBe(task.id);
  });

  test('completeTask marks task as completed', async () => {
    const task = await manager.createTask({ title: 'Finish me' });
    const completed = await manager.completeTask(task.id);

    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBeDefined();
  });

  test('completeTask records stats using the provided local date', async () => {
    const statsRepo = new RecordingStatsRepo();
    manager = new TaskManager(taskRepo, groupRepo, statsRepo, undefined, () => '2026-05-16');
    await manager.initialize();

    const task = await manager.createTask({ title: 'Finish me' });
    await manager.completeTask(task.id);

    expect(statsRepo.records).toHaveLength(1);
    expect(statsRepo.records[0]).toEqual({
      date: '2026-05-16',
      increment: {
        completedTasks: 1,
        tasks: [task.id],
      },
    });
  });

  test('deleteTask removes from group taskOrder', async () => {
    const group = await manager.createGroup({ name: 'Work' });
    const task = await manager.createTask({ title: 'Delete me', groupId: group.id });

    await manager.deleteTask(task.id);

    const updated = await manager.getGroup(group.id);
    expect(updated!.taskOrder).not.toContain(task.id);
    expect(await manager.getTask(task.id)).toBeNull();
  });

  test('moveTaskToGroup updates both groups taskOrder', async () => {
    const g1 = await manager.createGroup({ name: 'Group 1' });
    const g2 = await manager.createGroup({ name: 'Group 2' });
    const task = await manager.createTask({ title: 'Movable', groupId: g1.id });

    await manager.moveTaskToGroup(task.id, g2.id);

    const oldGroup = await manager.getGroup(g1.id);
    const newGroup = await manager.getGroup(g2.id);
    expect(oldGroup!.taskOrder).not.toContain(task.id);
    expect(newGroup!.taskOrder).toContain(task.id);

    const moved = await manager.getTask(task.id);
    expect(moved!.groupId).toBe(g2.id);
  });

  test('reorderTask moves task within the same group', async () => {
    const group = await manager.createGroup({ name: 'Work' });
    const t1 = await manager.createTask({ title: 'A', groupId: group.id });
    const t2 = await manager.createTask({ title: 'B', groupId: group.id });
    const t3 = await manager.createTask({ title: 'C', groupId: group.id });

    await manager.reorderTask(t3.id, 0);

    const updated = await manager.getGroup(group.id);
    expect(updated!.taskOrder).toEqual([t3.id, t1.id, t2.id]);
  });

  test('deleteGroup migrates group tasks to the default group and preserves order', async () => {
    const defaultTask = await manager.createTask({ title: 'Existing default task' });
    const group = await manager.createGroup({ name: 'Temp' });
    const movedTask1 = await manager.createTask({ title: 'T1', groupId: group.id });
    const movedTask2 = await manager.createTask({ title: 'T2', groupId: group.id });

    await manager.deleteGroup(group.id);

    expect(await manager.getGroup(group.id)).toBeNull();

    const allTasks = await manager.getAllTasks();
    expect(allTasks).toHaveLength(3);
    expect(allTasks.find((task) => task.id === movedTask1.id)?.groupId).toBe('default');
    expect(allTasks.find((task) => task.id === movedTask2.id)?.groupId).toBe('default');

    const defaultGroup = await manager.getGroup('default');
    expect(defaultGroup?.taskOrder).toEqual([defaultTask.id, movedTask1.id, movedTask2.id]);
  });

  test('deleteGroup ignores stale taskOrder IDs and tasks no longer belonging to the group', async () => {
    const defaultTask = await manager.createTask({ title: 'Existing default task' });
    const sourceGroup = await manager.createGroup({ name: 'Source' });
    const otherGroup = await manager.createGroup({ name: 'Other' });
    const movedTask = await manager.createTask({ title: 'Move me', groupId: sourceGroup.id });
    const otherGroupTask = await manager.createTask({ title: 'Stay put', groupId: otherGroup.id });

    await groupRepo.update(sourceGroup.id, {
      taskOrder: ['stale-task-id', movedTask.id, otherGroupTask.id],
    });

    await manager.deleteGroup(sourceGroup.id);

    expect(await manager.getGroup(sourceGroup.id)).toBeNull();

    const defaultGroup = await manager.getGroup('default');
    expect(defaultGroup?.taskOrder).toEqual([defaultTask.id, movedTask.id]);

    expect((await manager.getTask(movedTask.id))?.groupId).toBe('default');
    expect((await manager.getTask(otherGroupTask.id))?.groupId).toBe(otherGroup.id);
  });

  test('deleteGroup throws when trying to delete default group', async () => {
    await expect(manager.deleteGroup('default')).rejects.toThrow('Cannot delete the default group');
  });

  test('incrementPomodoro adds 1 to task completedPomodoros and promotes status', async () => {
    const task = await manager.createTask({ title: 'Code review' });
    expect(task.status).toBe('todo');
    const updated = await manager.incrementPomodoro(task.id, '2026-05-04');

    expect(updated.completedPomodoros).toBe(1);
    expect(updated.lastPomodoroTime).toBe('2026-05-04');
    expect(updated.status).toBe('in-progress');
  });

  test('getTasksByStatus filters correctly', async () => {
    const t1 = await manager.createTask({ title: 'Todo' });
    const t2 = await manager.createTask({ title: 'Done' });
    await manager.completeTask(t2.id);

    const todos = await manager.getTasksByStatus('todo');
    expect(todos).toHaveLength(1);
    expect(todos[0].id).toBe(t1.id);
  });

  test('getAllTasks returns all tasks', async () => {
    await manager.createTask({ title: 'Task A' });
    await manager.createTask({ title: 'Task B' });
    const all = await manager.getAllTasks();
    expect(all).toHaveLength(2);
  });

  test('renameGroup updates group name', async () => {
    const group = await manager.createGroup({ name: 'Original' });
    const updated = await manager.renameGroup(group.id, 'Renamed');
    expect(updated.name).toBe('Renamed');
    expect(updated.id).toBe(group.id);
  });
});
