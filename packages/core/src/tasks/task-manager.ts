import { Task, TaskGroup, NewTask, NewTaskGroup, TaskStatus, DEFAULT_GROUP_ID } from '../types/task.js';
import { generateId } from '../utils/id-generator.js';
import { addTaskAtPosition, reorderTasks, removeTaskFromOrder } from './sorting.js';

export type { Task, TaskGroup } from '../types/task.js';

export interface ITaskRepository {
  findAll(): Promise<Task[]>;
  findById(id: string): Promise<Task | null>;
  findByGroup(groupId: string): Promise<Task[]>;
  create(task: Task): Promise<Task>;
  update(id: string, updates: Partial<Task>): Promise<Task>;
  delete(id: string): Promise<void>;
}

export interface ITaskGroupRepository {
  findAll(): Promise<TaskGroup[]>;
  findById(id: string): Promise<TaskGroup | null>;
  create(group: TaskGroup): Promise<TaskGroup>;
  update(id: string, updates: Partial<TaskGroup>): Promise<TaskGroup>;
  delete(id: string): Promise<void>;
}

function makeTask(input: NewTask, groupId: string): Task {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: input.title,
    description: input.description,
    completedPomodoros: 0,
    status: 'todo',
    groupId: input.groupId ?? groupId,
    tags: input.tags,
    createdAt: now,
    updatedAt: now,
  };
}

function makeGroup(input: NewTaskGroup): TaskGroup {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: input.name,
    color: input.color,
    taskOrder: [],
    createdAt: now,
    updatedAt: now,
  };
}

export class TaskManager {
  constructor(
    private taskRepo: ITaskRepository,
    private groupRepo: ITaskGroupRepository,
  ) {}

  async initialize(): Promise<void> {
    const existing = await this.groupRepo.findById(DEFAULT_GROUP_ID);
    if (!existing) {
      const group = { ...makeGroup({ name: '未分组' }), id: DEFAULT_GROUP_ID };
      await this.groupRepo.create(group);
    }
  }

  async createTask(
    input: NewTask,
    referenceTaskId?: string,
    insertAfter?: boolean,
  ): Promise<Task> {
    const groupId = input.groupId ?? DEFAULT_GROUP_ID;
    const task = await this.taskRepo.create(makeTask(input, groupId));

    const group = await this.groupRepo.findById(groupId);
    if (group) {
      const updated = addTaskAtPosition(group, task.id, referenceTaskId, insertAfter ?? true);
      await this.groupRepo.update(groupId, { taskOrder: updated.taskOrder, updatedAt: updated.updatedAt });
    }

    return task;
  }

  async getTask(id: string): Promise<Task | null> {
    return this.taskRepo.findById(id);
  }

  async getAllTasks(): Promise<Task[]> {
    return this.taskRepo.findAll();
  }

  async getTasksByGroup(groupId: string): Promise<Task[]> {
    return this.taskRepo.findByGroup(groupId);
  }

  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    const all = await this.taskRepo.findAll();
    return all.filter((t) => t.status === status);
  }

  async editTask(id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'tags'>>): Promise<Task> {
    return this.taskRepo.update(id, updates);
  }

  async completeTask(id: string): Promise<Task> {
    return this.taskRepo.update(id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
  }

  async incrementPomodoro(id: string, dateStr?: string): Promise<Task> {
    const task = await this.taskRepo.findById(id);
    if (!task) throw new Error(`Task ${id} not found`);
    return this.taskRepo.update(id, {
      completedPomodoros: task.completedPomodoros + 1,
      lastPomodoroTime: dateStr ?? new Date().toISOString().slice(0, 10),
      status: task.status === 'todo' ? 'in-progress' : task.status,
    });
  }

  async deleteTask(id: string): Promise<void> {
    const task = await this.taskRepo.findById(id);
    if (!task) return;

    if (task.groupId) {
      const group = await this.groupRepo.findById(task.groupId);
      if (group) {
        const updated = removeTaskFromOrder(group, id);
        await this.groupRepo.update(task.groupId, { taskOrder: updated.taskOrder, updatedAt: updated.updatedAt });
      }
    }

    await this.taskRepo.delete(id);
  }

  async moveTaskToGroup(taskId: string, newGroupId: string): Promise<Task> {
    const task = await this.taskRepo.findById(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (task.groupId) {
      const oldGroup = await this.groupRepo.findById(task.groupId);
      if (oldGroup) {
        const updated = removeTaskFromOrder(oldGroup, taskId);
        await this.groupRepo.update(task.groupId, { taskOrder: updated.taskOrder, updatedAt: updated.updatedAt });
      }
    }

    const newGroup = await this.groupRepo.findById(newGroupId);
    if (!newGroup) throw new Error(`Target group ${newGroupId} not found`);

    const updated = addTaskAtPosition(newGroup, taskId);
    await this.groupRepo.update(newGroupId, { taskOrder: updated.taskOrder, updatedAt: updated.updatedAt });

    return this.taskRepo.update(taskId, { groupId: newGroupId });
  }

  async reorderTask(taskId: string, newIndex: number): Promise<void> {
    const task = await this.taskRepo.findById(taskId);
    if (!task?.groupId) return;

    const group = await this.groupRepo.findById(task.groupId);
    if (!group) return;

    const updated = reorderTasks(group, taskId, newIndex);
    await this.groupRepo.update(group.id, { taskOrder: updated.taskOrder, updatedAt: updated.updatedAt });
  }

  async createGroup(input: NewTaskGroup): Promise<TaskGroup> {
    return this.groupRepo.create(makeGroup(input));
  }

  async getGroup(id: string): Promise<TaskGroup | null> {
    return this.groupRepo.findById(id);
  }

  async getAllGroups(): Promise<TaskGroup[]> {
    return this.groupRepo.findAll();
  }

  async renameGroup(id: string, name: string): Promise<TaskGroup> {
    return this.groupRepo.update(id, { name });
  }

  async deleteGroup(id: string): Promise<void> {
    if (id === DEFAULT_GROUP_ID) {
      throw new Error('Cannot delete the default group');
    }
    const tasks = await this.taskRepo.findByGroup(id);
    for (const task of tasks) {
      await this.taskRepo.delete(task.id);
    }
    await this.groupRepo.delete(id);
  }
}
