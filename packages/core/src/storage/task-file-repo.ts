// packages/core/src/storage/task-file-repo.ts
import { Task } from '../types/task.js';
import { ITaskRepository } from '../tasks/task-manager.js';
import { FileStorage } from './file-storage.js';
import { getTaskPath } from './paths.js';
import { stringifyYaml, parseYaml } from './yaml-serializer.js';

interface TaskYaml {
  id: string;
  title: string;
  description?: string;
  notes?: string;
  status: 'todo' | 'in-progress' | 'completed';
  groupId?: string;
  completedPomodoros: number;
  lastPomodoroTime?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

function taskToYaml(task: Task): TaskYaml {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    notes: task.notes,
    status: task.status,
    groupId: task.groupId,
    completedPomodoros: task.completedPomodoros,
    lastPomodoroTime: task.lastPomodoroTime,
    tags: task.tags ? [...task.tags] : undefined,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
  };
}

function yamlToTask(yaml: TaskYaml): Task {
  return {
    id: yaml.id,
    title: yaml.title,
    description: yaml.description,
    notes: yaml.notes,
    status: yaml.status,
    groupId: yaml.groupId,
    completedPomodoros: yaml.completedPomodoros,
    lastPomodoroTime: yaml.lastPomodoroTime,
    tags: yaml.tags,
    createdAt: yaml.createdAt,
    updatedAt: yaml.updatedAt,
    completedAt: yaml.completedAt,
  };
}

export class TaskFileRepository implements ITaskRepository {
  constructor(private storage: FileStorage) {}

  async findAll(): Promise<Task[]> {
    await this.storage.ensureDir('.meta/entities/tasks');
    const files = await this.storage.listFiles('.meta/entities/tasks');
    const tasks: Task[] = [];

    for (const file of files) {
      if (file.endsWith('.yaml')) {
        const task = await this.findById(file.replace('.yaml', ''));
        if (task) tasks.push(task);
      }
    }

    return tasks;
  }

  async findById(id: string): Promise<Task | null> {
    const content = await this.storage.readFile(getTaskPath('', id).replace(/^\//, ''));
    if (!content) return null;

    const yaml = parseYaml<TaskYaml>(content);
    return yamlToTask(yaml);
  }

  async findByGroup(groupId: string): Promise<Task[]> {
    const all = await this.findAll();
    return all.filter((t) => t.groupId === groupId);
  }

  async create(task: Task): Promise<Task> {
    const yaml = taskToYaml(task);
    const content = stringifyYaml(yaml);
    await this.storage.writeFile(getTaskPath('', task.id).replace(/^\//, ''), content);
    return task;
  }

  async update(id: string, updates: Partial<Task>): Promise<Task> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Task ${id} not found`);

    const updated: Task = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    const yaml = taskToYaml(updated);
    const content = stringifyYaml(yaml);
    await this.storage.writeFile(getTaskPath('', id).replace(/^\//, ''), content);

    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.storage.deleteFile(getTaskPath('', id).replace(/^\//, ''));
  }
}
