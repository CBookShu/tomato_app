// packages/core/src/storage/group-file-repo.ts
import { TaskGroup } from '../types/task.js';
import { ITaskGroupRepository } from '../tasks/task-manager.js';
import { FileStorage } from './file-storage.js';
import { getGroupPath } from './paths.js';
import { stringifyYaml, parseYaml } from './yaml-serializer.js';

interface GroupYaml {
  name: string;
  color?: string;
  taskOrder: string[];
  createdAt: string;
  updatedAt: string;
}

function groupToYaml(group: TaskGroup): GroupYaml {
  return {
    name: group.name,
    color: group.color,
    taskOrder: [...group.taskOrder],
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

function yamlToGroup(id: string, yaml: GroupYaml): TaskGroup {
  return {
    id,
    name: yaml.name,
    color: yaml.color,
    taskOrder: yaml.taskOrder,
    createdAt: yaml.createdAt,
    updatedAt: yaml.updatedAt,
  };
}

export class GroupFileRepository implements ITaskGroupRepository {
  constructor(private storage: FileStorage) {}

  async findAll(): Promise<TaskGroup[]> {
    await this.storage.ensureDir('.meta/entities/groups');
    const files = await this.storage.listFiles('.meta/entities/groups');
    const groups: TaskGroup[] = [];

    for (const file of files) {
      if (file.endsWith('.yaml')) {
        const group = await this.findById(file.replace('.yaml', ''));
        if (group) groups.push(group);
      }
    }

    return groups;
  }

  async findById(id: string): Promise<TaskGroup | null> {
    const content = await this.storage.readFile(getGroupPath('', id).replace(/^\//, ''));
    if (!content) return null;

    const yaml = parseYaml<GroupYaml>(content);
    return yamlToGroup(id, yaml);
  }

  async create(group: TaskGroup): Promise<TaskGroup> {
    const yaml = groupToYaml(group);
    const content = stringifyYaml(yaml);
    await this.storage.writeFile(getGroupPath('', group.id).replace(/^\//, ''), content);
    return group;
  }

  async update(id: string, updates: Partial<TaskGroup>): Promise<TaskGroup> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Group ${id} not found`);

    const updated: TaskGroup = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    const yaml = groupToYaml(updated);
    const content = stringifyYaml(yaml);
    await this.storage.writeFile(getGroupPath('', id).replace(/^\//, ''), content);

    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.storage.deleteFile(getGroupPath('', id).replace(/^\//, ''));
  }
}
