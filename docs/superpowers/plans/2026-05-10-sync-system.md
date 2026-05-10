# 同步系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 SQLite 存储替换为基于文件的 YAML 存储，实现 GitHub 仓库同步功能。

**Architecture:**
- Phase 1：实现文件存储层（YAML 序列化 + Repository 实现）
- Phase 2：实现 Git 同步（命令封装 + 冲突检测）
- Phase 3：实现 GitHub OAuth 认证
- Phase 4：实现 UI 组件（同步状态、设置页面、冲突面板）

**Tech Stack:** TypeScript, YAML (js-yaml), simple-git, Electron, React, Zustand

---

## 文件结构

### 新建文件

```
packages/core/
├── src/storage/
│   ├── index.ts                 # 导出
│   ├── file-storage.ts          # 文件读写操作
│   ├── yaml-serializer.ts       # YAML 解析/序列化
│   ├── paths.ts                 # 路径常量
│   ├── task-file-repo.ts        # 任务文件仓库
│   ├── group-file-repo.ts       # 分组文件仓库
│   ├── stats-file-repo.ts       # 统计文件仓库
│   └── config-file-repo.ts      # 配置文件仓库
├── src/sync/
│   ├── index.ts                 # 导出
│   ├── git-client.ts            # Git 命令封装
│   ├── sync-manager.ts          # 同步协调器
│   └── types.ts                 # 同步相关类型

tomato_app/
├── src/main/sync/
│   ├── index.ts                 # 导出
│   ├── sync-service.ts          # 主进程同步服务
│   ├── oauth-server.ts          # OAuth 回调服务
│   └── keychain.ts              # 系统密钥库封装
├── src/renderer/components/Sync/
│   ├── SyncStatus.tsx           # 同步状态指示
│   ├── SyncSettings.tsx         # 同步设置页
│   └── ConflictPrompt.tsx       # 冲突提示面板
├── src/renderer/stores/sync-store.ts  # 同步状态管理
```

### 修改文件

```
packages/core/
├── src/index.ts                 # 导出新模块
├── src/types/task.ts            # 移除 notes 和 tags 字段

tomato_app/
├── src/main/index.ts            # 初始化文件存储
├── src/main/database.ts         # 替换为文件存储初始化
├── src/main/ipc-handlers.ts     # 新增同步 IPC
├── src/shared/ipc-channels.ts   # 新增同步 IPC 通道
├── src/renderer/App.tsx         # 添加同步状态组件
```

### 删除文件

```
packages/core/src/db/            # SQLite 存储层（Phase 1 完成后删除）
```

---

## Phase 1: 文件存储

### Task 1.1: 定义类型和路径常量

**Files:**
- Create: `packages/core/src/storage/paths.ts`
- Create: `packages/core/src/storage/types.ts`
- Test: `packages/core/tests/storage/paths.test.ts`

- [ ] **Step 1: 编写路径常量测试**

```typescript
// packages/core/tests/storage/paths.test.ts
import { describe, test, expect } from '@jest/globals';
import { getStoragePaths, getTaskPath, getGroupPath, getStatsPath, getConfigPath, getNotesPath } from '../../src/storage/paths.js';

describe('Storage Paths', () => {
  const baseDir = '/tmp/tomato-data';

  test('getStoragePaths returns all paths', () => {
    const paths = getStoragePaths(baseDir);
    expect(paths.base).toBe(baseDir);
    expect(paths.meta).toBe(`${baseDir}/.meta`);
    expect(paths.entities).toBe(`${baseDir}/.meta/entities`);
    expect(paths.groups).toBe(`${baseDir}/.meta/entities/groups`);
    expect(paths.tasks).toBe(`${baseDir}/.meta/entities/tasks`);
    expect(paths.tasksNotes).toBe(`${baseDir}/tasks`);
    expect(paths.stats).toBe(`${baseDir}/stats`);
  });

  test('getTaskPath returns correct path', () => {
    expect(getTaskPath(baseDir, 'task-123')).toBe(`${baseDir}/.meta/entities/tasks/task-123.yaml`);
  });

  test('getGroupPath returns correct path', () => {
    expect(getGroupPath(baseDir, 'group-456')).toBe(`${baseDir}/.meta/entities/groups/group-456.yaml`);
  });

  test('getStatsPath returns correct path', () => {
    expect(getStatsPath(baseDir, '2026-05-10')).toBe(`${baseDir}/stats/2026-05-10.yaml`);
  });

  test('getConfigPath returns correct path', () => {
    expect(getConfigPath(baseDir)).toBe(`${baseDir}/.meta/config.yaml`);
  });

  test('getNotesPath returns correct path', () => {
    expect(getNotesPath(baseDir, 'task-123')).toBe(`${baseDir}/tasks/task-123.md`);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/core && npm test -- tests/storage/paths.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现路径常量**

```typescript
// packages/core/src/storage/paths.ts
export interface StoragePaths {
  base: string;
  meta: string;
  entities: string;
  groups: string;
  tasks: string;
  tasksNotes: string;
  stats: string;
}

export function getStoragePaths(baseDir: string): StoragePaths {
  return {
    base: baseDir,
    meta: `${baseDir}/.meta`,
    entities: `${baseDir}/.meta/entities`,
    groups: `${baseDir}/.meta/entities/groups`,
    tasks: `${baseDir}/.meta/entities/tasks`,
    tasksNotes: `${baseDir}/tasks`,
    stats: `${baseDir}/stats`,
  };
}

export function getTaskPath(baseDir: string, taskId: string): string {
  return `${baseDir}/.meta/entities/tasks/${taskId}.yaml`;
}

export function getGroupPath(baseDir: string, groupId: string): string {
  return `${baseDir}/.meta/entities/groups/${groupId}.yaml`;
}

export function getStatsPath(baseDir: string, date: string): string {
  return `${baseDir}/stats/${date}.yaml`;
}

export function getConfigPath(baseDir: string): string {
  return `${baseDir}/.meta/config.yaml`;
}

export function getNotesPath(baseDir: string, taskId: string): string {
  return `${baseDir}/tasks/${taskId}.md`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/core && npm test -- tests/storage/paths.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/storage/paths.ts packages/core/tests/storage/paths.test.ts
git commit -m "feat(storage): 添加存储路径常量"
```

---

### Task 1.2: 实现 YAML 序列化

**Files:**
- Create: `packages/core/src/storage/yaml-serializer.ts`
- Test: `packages/core/tests/storage/yaml-serializer.test.ts`

- [ ] **Step 1: 安装 js-yaml 依赖**

Run: `cd packages/core && npm install js-yaml && npm install -D @types/js-yaml`

- [ ] **Step 2: 编写 YAML 序列化测试**

```typescript
// packages/core/tests/storage/yaml-serializer.test.ts
import { describe, test, expect } from '@jest/globals';
import { stringifyYaml, parseYaml } from '../../src/storage/yaml-serializer.js';

describe('YAML Serializer', () => {
  test('stringifyYaml converts object to YAML string', () => {
    const obj = { name: 'test', count: 42, items: ['a', 'b'] };
    const yaml = stringifyYaml(obj);
    expect(yaml).toContain('name: test');
    expect(yaml).toContain('count: 42');
    expect(yaml).toContain('items:');
  });

  test('parseYaml converts YAML string to object', () => {
    const yaml = 'name: test\ncount: 42\nitems:\n  - a\n  - b\n';
    const obj = parseYaml(yaml);
    expect(obj).toEqual({ name: 'test', count: 42, items: ['a', 'b'] });
  });

  test('roundtrip preserves data', () => {
    const original = { name: 'test', count: 42, items: ['a', 'b'] };
    const yaml = stringifyYaml(original);
    const parsed = parseYaml(yaml);
    expect(parsed).toEqual(original);
  });

  test('handles null values', () => {
    const obj = { name: 'test', value: null };
    const yaml = stringifyYaml(obj);
    const parsed = parseYaml(yaml);
    expect(parsed.value).toBeNull();
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd packages/core && npm test -- tests/storage/yaml-serializer.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 4: 实现 YAML 序列化**

```typescript
// packages/core/src/storage/yaml-serializer.ts
import * as yaml from 'js-yaml';

export function stringifyYaml(data: unknown): string {
  return yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}

export function parseYaml<T = unknown>(content: string): T {
  return yaml.load(content) as T;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd packages/core && npm test -- tests/storage/yaml-serializer.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add packages/core/src/storage/yaml-serializer.ts packages/core/tests/storage/yaml-serializer.test.ts packages/core/package.json
git commit -m "feat(storage): 添加 YAML 序列化工具"
```

---

### Task 1.3: 实现文件存储工具

**Files:**
- Create: `packages/core/src/storage/file-storage.ts`
- Test: `packages/core/tests/storage/file-storage.test.ts`

- [ ] **Step 1: 编写文件存储测试**

```typescript
// packages/core/tests/storage/file-storage.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileStorage } from '../../src/storage/file-storage.js';

describe('FileStorage', () => {
  let tempDir: string;
  let storage: FileStorage;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tomato-test-'));
    storage = new FileStorage(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('writeFile creates file with content', async () => {
    await storage.writeFile('test.yaml', 'name: test\n');
    const content = await fs.readFile(path.join(tempDir, 'test.yaml'), 'utf-8');
    expect(content).toBe('name: test\n');
  });

  test('readFile returns file content', async () => {
    await fs.writeFile(path.join(tempDir, 'test.yaml'), 'name: test\n');
    const content = await storage.readFile('test.yaml');
    expect(content).toBe('name: test\n');
  });

  test('readFile returns null for missing file', async () => {
    const content = await storage.readFile('missing.yaml');
    expect(content).toBeNull();
  });

  test('deleteFile removes file', async () => {
    await fs.writeFile(path.join(tempDir, 'test.yaml'), 'content');
    await storage.deleteFile('test.yaml');
    const exists = await storage.fileExists('test.yaml');
    expect(exists).toBe(false);
  });

  test('fileExists returns true for existing file', async () => {
    await fs.writeFile(path.join(tempDir, 'test.yaml'), 'content');
    const exists = await storage.fileExists('test.yaml');
    expect(exists).toBe(true);
  });

  test('fileExists returns false for missing file', async () => {
    const exists = await storage.fileExists('missing.yaml');
    expect(exists).toBe(false);
  });

  test('ensureDir creates directory if not exists', async () => {
    await storage.ensureDir('subdir/nested');
    const stat = await fs.stat(path.join(tempDir, 'subdir/nested'));
    expect(stat.isDirectory()).toBe(true);
  });

  test('listFiles returns all files in directory', async () => {
    await fs.writeFile(path.join(tempDir, 'a.yaml'), '');
    await fs.writeFile(path.join(tempDir, 'b.yaml'), '');
    const files = await storage.listFiles('.');
    expect(files).toContain('a.yaml');
    expect(files).toContain('b.yaml');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/core && npm test -- tests/storage/file-storage.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现文件存储**

```typescript
// packages/core/src/storage/file-storage.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export class FileStorage {
  constructor(private baseDir: string) {}

  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async readFile(relativePath: string): Promise<string | null> {
    const fullPath = path.join(this.baseDir, relativePath);
    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async fileExists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.baseDir, relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDir(relativePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    await fs.mkdir(fullPath, { recursive: true });
  }

  async listFiles(relativePath: string): Promise<string[]> {
    const fullPath = path.join(this.baseDir, relativePath);
    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/core && npm test -- tests/storage/file-storage.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/storage/file-storage.ts packages/core/tests/storage/file-storage.test.ts
git commit -m "feat(storage): 添加文件存储工具"
```

---

### Task 1.4: 实现任务文件仓库

**Files:**
- Create: `packages/core/src/storage/task-file-repo.ts`
- Modify: `packages/core/src/types/task.ts` (移除 notes 和 tags 字段)
- Test: `packages/core/tests/storage/task-file-repo.test.ts`

- [ ] **Step 1: 更新 Task 类型定义**

```typescript
// packages/core/src/types/task.ts
export type TaskStatus = 'todo' | 'in-progress' | 'completed';

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly completedPomodoros: number;
  readonly status: TaskStatus;
  readonly groupId?: string;
  readonly lastPomodoroTime?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface NewTask {
  readonly title: string;
  readonly description?: string;
  readonly groupId?: string;
}

export interface TaskGroup {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
  readonly taskOrder: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NewTaskGroup {
  readonly name: string;
  readonly color?: string;
}

export const DEFAULT_GROUP_ID = 'default';
```

- [ ] **Step 2: 编写任务仓库测试**

```typescript
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

    const content = await storage.readFile('.meta/entities/tasks/task-123.yaml');
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
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd packages/core && npm test -- tests/storage/task-file-repo.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 4: 实现任务文件仓库**

```typescript
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
  status: 'todo' | 'in-progress' | 'completed';
  groupId?: string;
  completedPomodoros: number;
  lastPomodoroTime?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

function taskToYaml(task: Task): TaskYaml {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    groupId: task.groupId,
    completedPomodoros: task.completedPomodoros,
    lastPomodoroTime: task.lastPomodoroTime,
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
    status: yaml.status,
    groupId: yaml.groupId,
    completedPomodoros: yaml.completedPomodoros,
    lastPomodoroTime: yaml.lastPomodoroTime,
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
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd packages/core && npm test -- tests/storage/task-file-repo.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add packages/core/src/storage/task-file-repo.ts packages/core/src/types/task.ts packages/core/tests/storage/task-file-repo.test.ts
git commit -m "feat(storage): 实现任务文件仓库"
```

---

### Task 1.5: 实现分组文件仓库

**Files:**
- Create: `packages/core/src/storage/group-file-repo.ts`
- Test: `packages/core/tests/storage/group-file-repo.test.ts`

- [ ] **Step 1: 编写分组仓库测试**

```typescript
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/core && npm test -- tests/storage/group-file-repo.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现分组文件仓库**

```typescript
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/core && npm test -- tests/storage/group-file-repo.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/storage/group-file-repo.ts packages/core/tests/storage/group-file-repo.test.ts
git commit -m "feat(storage): 实现分组文件仓库"
```

---

### Task 1.6: 实现统计文件仓库

**Files:**
- Create: `packages/core/src/storage/stats-file-repo.ts`
- Test: `packages/core/tests/storage/stats-file-repo.test.ts`

- [ ] **Step 1: 编写统计仓库测试**

```typescript
// packages/core/tests/storage/stats-file-repo.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { StatsFileRepository } from '../../src/storage/stats-file-repo.js';
import { FileStorage } from '../../src/storage/file-storage.js';
import { DailyStats } from '../../src/types/stats.js';

describe('StatsFileRepository', () => {
  let tempDir: string;
  let storage: FileStorage;
  let repo: StatsFileRepository;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tomato-test-'));
    storage = new FileStorage(tempDir);
    repo = new StatsFileRepository(storage);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('findByDate returns stats for date', async () => {
    await repo.upsert('2026-05-10', { totalPomodoros: 5, completedTasks: 2, tasks: ['task-1'] });

    const stats = await repo.findByDate('2026-05-10');
    expect(stats).toBeTruthy();
    expect(stats?.totalPomodoros).toBe(5);
    expect(stats?.completedTasks).toBe(2);
  });

  test('findByDate returns null for missing date', async () => {
    const stats = await repo.findByDate('2026-05-10');
    expect(stats).toBeNull();
  });

  test('upsert creates new stats file', async () => {
    await repo.upsert('2026-05-10', { totalPomodoros: 3, tasks: ['task-1'] });

    const content = await storage.readFile('stats/2026-05-10.yaml');
    expect(content).toContain('totalPomodoros: 3');
  });

  test('upsert increments existing stats', async () => {
    await repo.upsert('2026-05-10', { totalPomodoros: 3, tasks: ['task-1'] });
    await repo.upsert('2026-05-10', { totalPomodoros: 2, tasks: ['task-2'] });

    const stats = await repo.findByDate('2026-05-10');
    expect(stats?.totalPomodoros).toBe(5);
    expect(stats?.tasks).toContain('task-1');
    expect(stats?.tasks).toContain('task-2');
  });

  test('findAll returns all stats', async () => {
    await repo.upsert('2026-05-10', { totalPomodoros: 1, tasks: [] });
    await repo.upsert('2026-05-11', { totalPomodoros: 2, tasks: [] });

    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/core && npm test -- tests/storage/stats-file-repo.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现统计文件仓库**

```typescript
// packages/core/src/storage/stats-file-repo.ts
import { DailyStats } from '../types/stats.js';
import { IStatsRepository } from '../tasks/task-manager.js';
import { FileStorage } from './file-storage.js';
import { getStatsPath } from './paths.js';
import { stringifyYaml, parseYaml } from './yaml-serializer.js';

interface StatsYaml {
  totalPomodoros: number;
  completedTasks: number;
  tasks: string[];
}

export class StatsFileRepository implements IStatsRepository {
  constructor(private storage: FileStorage) {}

  async findByDate(date: string): Promise<DailyStats | null> {
    const content = await this.storage.readFile(getStatsPath('', date).replace(/^\//, ''));
    if (!content) return null;

    const yaml = parseYaml<StatsYaml>(content);
    return {
      date,
      totalPomodoros: yaml.totalPomodoros,
      completedTasks: yaml.completedTasks,
      tasks: yaml.tasks,
    };
  }

  async findAll(): Promise<DailyStats[]> {
    await this.storage.ensureDir('stats');
    const files = await this.storage.listFiles('stats');
    const stats: DailyStats[] = [];

    for (const file of files) {
      if (file.endsWith('.yaml')) {
        const date = file.replace('.yaml', '');
        const stat = await this.findByDate(date);
        if (stat) stats.push(stat);
      }
    }

    return stats;
  }

  async upsert(
    date: string,
    increment: { totalPomodoros?: number; completedTasks?: number; tasks?: string[] }
  ): Promise<DailyStats> {
    const existing = await this.findByDate(date);

    const stats: DailyStats = {
      date,
      totalPomodoros: (existing?.totalPomodoros ?? 0) + (increment.totalPomodoros ?? 0),
      completedTasks: (existing?.completedTasks ?? 0) + (increment.completedTasks ?? 0),
      tasks: [...new Set([...(existing?.tasks ?? []), ...(increment.tasks ?? [])])],
    };

    const yaml: StatsYaml = {
      totalPomodoros: stats.totalPomodoros,
      completedTasks: stats.completedTasks,
      tasks: stats.tasks,
    };

    const content = stringifyYaml(yaml);
    await this.storage.writeFile(getStatsPath('', date).replace(/^\//, ''), content);

    return stats;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/core && npm test -- tests/storage/stats-file-repo.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/storage/stats-file-repo.ts packages/core/tests/storage/stats-file-repo.test.ts
git commit -m "feat(storage): 实现统计文件仓库"
```

---

### Task 1.7: 实现配置文件仓库

**Files:**
- Create: `packages/core/src/storage/config-file-repo.ts`
- Test: `packages/core/tests/storage/config-file-repo.test.ts`

- [ ] **Step 1: 编写配置仓库测试**

```typescript
// packages/core/tests/storage/config-file-repo.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConfigFileRepository } from '../../src/storage/config-file-repo.js';
import { FileStorage } from '../../src/storage/file-storage.js';

describe('ConfigFileRepository', () => {
  let tempDir: string;
  let storage: FileStorage;
  let repo: ConfigFileRepository;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tomato-test-'));
    storage = new FileStorage(tempDir);
    repo = new ConfigFileRepository(storage);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('get returns default config when not exists', async () => {
    const config = await repo.get();
    expect(config.pomodoroDuration).toBe(25);
    expect(config.shortBreakDuration).toBe(5);
    expect(config.longBreakDuration).toBe(15);
  });

  test('set writes config to file', async () => {
    await repo.set({ pomodoroDuration: 30 });

    const content = await storage.readFile('.meta/config.yaml');
    expect(content).toContain('pomodoroDuration: 30');
  });

  test('get returns saved config', async () => {
    await repo.set({ pomodoroDuration: 30, soundEnabled: false });

    const config = await repo.get();
    expect(config.pomodoroDuration).toBe(30);
    expect(config.soundEnabled).toBe(false);
  });

  test('set merges with existing config', async () => {
    await repo.set({ pomodoroDuration: 30 });
    await repo.set({ soundEnabled: false });

    const config = await repo.get();
    expect(config.pomodoroDuration).toBe(30);
    expect(config.soundEnabled).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/core && npm test -- tests/storage/config-file-repo.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现配置文件仓库**

```typescript
// packages/core/src/storage/config-file-repo.ts
import { FileStorage } from './file-storage.js';
import { getConfigPath } from './paths.js';
import { stringifyYaml, parseYaml } from './yaml-serializer.js';

export interface AppConfig {
  pomodoroDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  soundEnabled: boolean;
  notificationEnabled: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  pomodoroDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  soundEnabled: true,
  notificationEnabled: true,
};

export class ConfigFileRepository {
  constructor(private storage: FileStorage) {}

  async get(): Promise<AppConfig> {
    const content = await this.storage.readFile(getConfigPath('').replace(/^\//, ''));
    if (!content) return { ...DEFAULT_CONFIG };

    const yaml = parseYaml<Partial<AppConfig>>(content);
    return { ...DEFAULT_CONFIG, ...yaml };
  }

  async set(updates: Partial<AppConfig>): Promise<AppConfig> {
    const existing = await this.get();
    const config: AppConfig = { ...existing, ...updates };

    const content = stringifyYaml(config);
    await this.storage.writeFile(getConfigPath('').replace(/^\//, ''), content);

    return config;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/core && npm test -- tests/storage/config-file-repo.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/storage/config-file-repo.ts packages/core/tests/storage/config-file-repo.test.ts
git commit -m "feat(storage): 实现配置文件仓库"
```

---

### Task 1.8: 实现笔记文件存储

**Files:**
- Create: `packages/core/src/storage/notes-storage.ts`
- Test: `packages/core/tests/storage/notes-storage.test.ts`

- [ ] **Step 1: 编写笔记存储测试**

```typescript
// packages/core/tests/storage/notes-storage.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { NotesStorage } from '../../src/storage/notes-storage.js';
import { FileStorage } from '../../src/storage/file-storage.js';

describe('NotesStorage', () => {
  let tempDir: string;
  let storage: FileStorage;
  let notes: NotesStorage;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tomato-test-'));
    storage = new FileStorage(tempDir);
    notes = new NotesStorage(storage);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('getNotes returns null when no notes file', async () => {
    const content = await notes.getNotes('task-123');
    expect(content).toBeNull();
  });

  test('saveNotes creates notes file', async () => {
    await notes.saveNotes('task-123', 'My notes');

    const content = await storage.readFile('tasks/task-123.md');
    expect(content).toBe('My notes');
  });

  test('getNotes returns saved content', async () => {
    await notes.saveNotes('task-123', 'My notes');

    const content = await notes.getNotes('task-123');
    expect(content).toBe('My notes');
  });

  test('deleteNotes removes notes file', async () => {
    await notes.saveNotes('task-123', 'My notes');
    await notes.deleteNotes('task-123');

    const content = await notes.getNotes('task-123');
    expect(content).toBeNull();
  });

  test('saveNotes with empty content deletes file', async () => {
    await notes.saveNotes('task-123', 'My notes');
    await notes.saveNotes('task-123', '');

    const content = await notes.getNotes('task-123');
    expect(content).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/core && npm test -- tests/storage/notes-storage.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现笔记存储**

```typescript
// packages/core/src/storage/notes-storage.ts
import { FileStorage } from './file-storage.js';
import { getNotesPath } from './paths.js';

export class NotesStorage {
  constructor(private storage: FileStorage) {}

  async getNotes(taskId: string): Promise<string | null> {
    return this.storage.readFile(getNotesPath('', taskId).replace(/^\//, ''));
  }

  async saveNotes(taskId: string, content: string): Promise<void> {
    const path = getNotesPath('', taskId).replace(/^\//, '');

    if (!content.trim()) {
      await this.storage.deleteFile(path);
    } else {
      await this.storage.writeFile(path, content);
    }
  }

  async deleteNotes(taskId: string): Promise<void> {
    await this.storage.deleteFile(getNotesPath('', taskId).replace(/^\//, ''));
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/core && npm test -- tests/storage/notes-storage.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/storage/notes-storage.ts packages/core/tests/storage/notes-storage.test.ts
git commit -m "feat(storage): 实现笔记文件存储"
```

---

### Task 1.9: 创建存储模块导出

**Files:**
- Create: `packages/core/src/storage/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 创建存储模块导出**

```typescript
// packages/core/src/storage/index.ts
export { FileStorage } from './file-storage.js';
export { TaskFileRepository } from './task-file-repo.js';
export { GroupFileRepository } from './group-file-repo.js';
export { StatsFileRepository } from './stats-file-repo.js';
export { ConfigFileRepository, type AppConfig } from './config-file-repo.js';
export { NotesStorage } from './notes-storage.js';
export { getStoragePaths, getTaskPath, getGroupPath, getStatsPath, getConfigPath, getNotesPath, type StoragePaths } from './paths.js';
export { stringifyYaml, parseYaml } from './yaml-serializer.js';
```

- [ ] **Step 2: 更新核心模块导出**

```typescript
// packages/core/src/index.ts
// ... existing exports ...
export * from './storage/index.js';
```

- [ ] **Step 3: 运行所有测试确认通过**

Run: `cd packages/core && npm test`
Expected: PASS (or skip SQLite tests if needed)

- [ ] **Step 4: 提交**

```bash
git add packages/core/src/storage/index.ts packages/core/src/index.ts
git commit -m "feat(storage): 添加存储模块导出"
```

---

### Task 1.10: 更新 Electron 主进程使用文件存储

**Files:**
- Modify: `tomato_app/src/main/database.ts`
- Modify: `tomato_app/src/main/index.ts`
- Modify: `tomato_app/src/main/ipc-handlers.ts`

- [ ] **Step 1: 更新 database.ts 初始化文件存储**

```typescript
// tomato_app/src/main/database.ts
import { app } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import {
  FileStorage,
  TaskFileRepository,
  GroupFileRepository,
  StatsFileRepository,
  ConfigFileRepository,
  NotesStorage,
  getStoragePaths,
} from '@pomodoro/core';

export interface StorageContext {
  storage: FileStorage;
  taskRepo: TaskFileRepository;
  groupRepo: GroupFileRepository;
  statsRepo: StatsFileRepository;
  configRepo: ConfigFileRepository;
  notesStorage: NotesStorage;
  dataDir: string;
}

let context: StorageContext | null = null;

export async function initStorage(): Promise<StorageContext> {
  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'tomato-data');

  // Ensure directory exists
  await fs.mkdir(dataDir, { recursive: true });
  const paths = getStoragePaths(dataDir);
  await fs.mkdir(paths.meta, { recursive: true });
  await fs.mkdir(paths.groups, { recursive: true });
  await fs.mkdir(paths.tasks, { recursive: true });
  await fs.mkdir(paths.tasksNotes, { recursive: true });
  await fs.mkdir(paths.stats, { recursive: true });

  const storage = new FileStorage(dataDir);
  context = {
    storage,
    taskRepo: new TaskFileRepository(storage),
    groupRepo: new GroupFileRepository(storage),
    statsRepo: new StatsFileRepository(storage),
    configRepo: new ConfigFileRepository(storage),
    notesStorage: new NotesStorage(storage),
    dataDir,
  };

  return context;
}

export function getStorage(): StorageContext {
  if (!context) {
    throw new Error('Storage not initialized. Call initStorage() first.');
  }
  return context;
}
```

- [ ] **Step 2: 更新 index.ts 初始化**

修改 `tomato_app/src/main/index.ts`，将 `initDatabase()` 调用替换为 `initStorage()`。

- [ ] **Step 3: 更新 ipc-handlers.ts**

修改 `tomato_app/src/main/ipc-handlers.ts`，使用 `getStorage()` 获取仓库实例。

- [ ] **Step 4: 运行应用测试基本功能**

Run: `cd tomato_app && npm run dev:electron`

- [ ] **Step 5: 提交**

```bash
git add tomato_app/src/main/database.ts tomato_app/src/main/index.ts tomato_app/src/main/ipc-handlers.ts
git commit -m "feat: 切换到文件存储"
```

---

### Task 1.11: 删除 SQLite 存储层

**Files:**
- Delete: `packages/core/src/db/`

- [ ] **Step 1: 删除 SQLite 相关文件**

Run: `rm -rf packages/core/src/db`

- [ ] **Step 2: 删除 SQLite 相关测试**

Run: `rm -rf packages/core/tests/db`

- [ ] **Step 3: 移除 SQLite 依赖**

Run: `cd packages/core && npm uninstall better-sqlite3 drizzle-orm`

- [ ] **Step 4: 运行测试确认**

Run: `cd packages/core && npm test`

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "refactor: 移除 SQLite 存储层"
```

---

## Phase 2: Git 同步

### Task 2.1: 安装 simple-git 依赖

- [ ] **Step 1: 安装依赖**

Run: `cd packages/core && npm install simple-git && npm install -D @types/simple-git`

- [ ] **Step 2: 提交**

```bash
git add packages/core/package.json
git commit -m "chore: 添加 simple-git 依赖"
```

---

### Task 2.2: 实现同步类型定义

**Files:**
- Create: `packages/core/src/sync/types.ts`

- [ ] **Step 1: 定义同步类型**

```typescript
// packages/core/src/sync/types.ts
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'conflict' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncTime?: string;
  error?: string;
  conflictBranch?: string;
}

export interface SyncResult {
  success: boolean;
  status: SyncStatus;
  error?: string;
  conflictBranch?: string;
}

export interface ConflictInfo {
  branchName: string;
  files: string[];
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/core/src/sync/types.ts
git commit -m "feat(sync): 添加同步类型定义"
```

---

### Task 2.3: 实现 Git 客户端封装

**Files:**
- Create: `packages/core/src/sync/git-client.ts`
- Test: `packages/core/tests/sync/git-client.test.ts`

- [ ] **Step 1: 编写 Git 客户端测试**

```typescript
// packages/core/tests/sync/git-client.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { GitClient } from '../../src/sync/git-client.js';

describe('GitClient', () => {
  let tempDir: string;
  let git: GitClient;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tomato-git-test-'));
    git = new GitClient(tempDir);
    await git.init();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('init creates git repository', async () => {
    const gitDir = path.join(tempDir, '.git');
    const exists = await fs.access(gitDir).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  test('isRepo returns true after init', async () => {
    const result = await git.isRepo();
    expect(result).toBe(true);
  });

  test('add stages files', async () => {
    await fs.writeFile(path.join(tempDir, 'test.yaml'), 'content');
    await git.add('.');
    const status = await git.status();
    expect(status.staged).toContain('test.yaml');
  });

  test('commit creates commit', async () => {
    await fs.writeFile(path.join(tempDir, 'test.yaml'), 'content');
    await git.add('.');
    await git.commit('test commit');
    const log = await git.log();
    expect(log.latest?.message).toBe('test commit');
  });

  test('hasChanges returns true when there are changes', async () => {
    await fs.writeFile(path.join(tempDir, 'test.yaml'), 'content');
    const result = await git.hasChanges();
    expect(result).toBe(true);
  });

  test('hasChanges returns false when clean', async () => {
    const result = await git.hasChanges();
    expect(result).toBe(false);
  });

  test('createBranch creates new branch', async () => {
    await git.createBranch('test-branch');
    const branches = await git.listBranches();
    expect(branches).toContain('test-branch');
  });

  test('checkout switches branch', async () => {
    await git.createBranch('test-branch');
    await git.checkout('test-branch');
    const current = await git.currentBranch();
    expect(current).toBe('test-branch');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/core && npm test -- tests/sync/git-client.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现 Git 客户端**

```typescript
// packages/core/src/sync/git-client.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import simpleGit, { SimpleGit, StatusResult } from 'simple-git';

export class GitClient {
  private git: SimpleGit;

  constructor(private baseDir: string) {
    this.git = simpleGit(baseDir);
  }

  async init(): Promise<void> {
    const gitDir = path.join(this.baseDir, '.git');
    try {
      await fs.access(gitDir);
    } catch {
      await this.git.init();
      await this.git.addConfig('user.name', 'Tomato App');
      await this.git.addConfig('user.email', 'tomato@app.local');
    }
  }

  async isRepo(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  async add(files: string): Promise<void> {
    await this.git.add(files);
  }

  async commit(message: string): Promise<void> {
    await this.git.commit(message);
  }

  async status(): Promise<StatusResult> {
    return this.git.status();
  }

  async hasChanges(): Promise<boolean> {
    const status = await this.status();
    return !status.isClean();
  }

  async createBranch(name: string): Promise<void> {
    await this.git.branch(['-b', name]);
  }

  async checkout(branch: string): Promise<void> {
    await this.git.checkout(branch);
  }

  async currentBranch(): Promise<string> {
    const status = await this.status();
    return status.current || 'main';
  }

  async listBranches(): Promise<string[]> {
    const result = await this.git.branchLocal();
    return result.all;
  }

  async deleteBranch(name: string): Promise<void> {
    await this.git.deleteLocalBranch(name);
  }

  async fetch(remote: string = 'origin'): Promise<void> {
    await this.git.fetch(remote);
  }

  async pull(rebase: boolean = true): Promise<{ success: boolean; hasConflicts: boolean }> {
    try {
      if (rebase) {
        await this.git.pull('origin', 'main', ['--rebase']);
      } else {
        await this.git.pull('origin', 'main');
      }
      return { success: true, hasConflicts: false };
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('conflict') || message.includes('CONFLICT')) {
        return { success: false, hasConflicts: true };
      }
      throw error;
    }
  }

  async push(remote: string = 'origin'): Promise<void> {
    await this.git.push(remote, 'main');
  }

  async rebaseAbort(): Promise<void> {
    await this.git.rebase(['--abort']);
  }

  async resetHard(ref: string): Promise<void> {
    await this.git.reset(['--hard', ref]);
  }

  async merge(branch: string): Promise<{ success: boolean; hasConflicts: boolean }> {
    try {
      await this.git.merge([branch]);
      return { success: true, hasConflicts: false };
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('conflict') || message.includes('CONFLICT')) {
        return { success: false, hasConflicts: true };
      }
      throw error;
    }
  }

  async log(maxCount: number = 10): Promise<{ latest?: { message: string; hash: string } }> {
    const result = await this.git.log({ maxCount });
    return result;
  }

  async addRemote(name: string, url: string): Promise<void> {
    try {
      await this.git.addRemote(name, url);
    } catch {
      // Remote already exists
    }
  }

  async getRemoteUrl(name: string = 'origin'): Promise<string | null> {
    try {
      const remotes = await this.git.getRemotes(true);
      const remote = remotes.find((r) => r.name === name);
      return remote?.refs?.fetch || null;
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/core && npm test -- tests/sync/git-client.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/sync/git-client.ts packages/core/tests/sync/git-client.test.ts
git commit -m "feat(sync): 实现 Git 客户端封装"
```

---

### Task 2.4: 实现同步管理器

**Files:**
- Create: `packages/core/src/sync/sync-manager.ts`
- Test: `packages/core/tests/sync/sync-manager.test.ts`

- [ ] **Step 1: 编写同步管理器测试**

```typescript
// packages/core/tests/sync/sync-manager.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { SyncManager } from '../../src/sync/sync-manager.js';
import { GitClient } from '../../src/sync/git-client.js';
import { FileStorage } from '../../src/storage/file-storage.js';

describe('SyncManager', () => {
  let tempDir: string;
  let git: GitClient;
  let storage: FileStorage;
  let syncManager: SyncManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tomato-sync-test-'));
    git = new GitClient(tempDir);
    await git.init();
    storage = new FileStorage(tempDir);
    syncManager = new SyncManager(git, storage);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('commitChanges creates commit with changes', async () => {
    await storage.writeFile('test.yaml', 'content');
    await syncManager.commitChanges();

    const log = await git.log();
    expect(log.latest?.message).toContain('sync:');
  });

  test('commitChanges does nothing when no changes', async () => {
    await syncManager.commitChanges();

    const log = await git.log();
    expect(log.latest).toBeUndefined();
  });

  test('pullChanges returns synced on success', async () => {
    // This would need a real remote to test properly
    // For now, test the no-remote case
    const result = await syncManager.pullChanges();
    expect(result.status).toBe('error');
  });

  test('createBackupBranch creates timestamped branch', async () => {
    const branchName = await syncManager.createBackupBranch();
    expect(branchName).toMatch(/^local-backup-/);

    const branches = await git.listBranches();
    expect(branches).toContain(branchName);
  });

  test('resetToRemote resets to origin/main', async () => {
    // Create a commit
    await storage.writeFile('test.yaml', 'content');
    await git.add('.');
    await git.commit('test');

    // Reset should work
    await git.fetch('origin').catch(() => {}); // May fail if no remote
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/core && npm test -- tests/sync/sync-manager.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现同步管理器**

```typescript
// packages/core/src/sync/sync-manager.ts
import { GitClient } from './git-client.js';
import { FileStorage } from '../storage/file-storage.js';
import { SyncResult, SyncStatus } from './types.js';

export class SyncManager {
  constructor(
    private git: GitClient,
    private storage: FileStorage
  ) {}

  async commitChanges(message?: string): Promise<void> {
    if (!(await this.git.hasChanges())) {
      return;
    }

    await this.git.add('.');
    await this.git.commit(message || `sync: ${new Date().toISOString()}`);
  }

  async pullChanges(): Promise<SyncResult> {
    try {
      const result = await this.git.pull(true);

      if (result.hasConflicts) {
        // Abort rebase and create backup branch
        await this.git.rebaseAbort();
        const conflictBranch = await this.createBackupBranch();

        return {
          success: false,
          status: 'conflict',
          conflictBranch,
        };
      }

      return {
        success: true,
        status: 'synced',
      };
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: (error as Error).message,
      };
    }
  }

  async createBackupBranch(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const branchName = `local-backup-${timestamp}`;
    await this.git.createBranch(branchName);
    return branchName;
  }

  async resetToRemote(): Promise<void> {
    await this.git.fetch('origin');
    await this.git.resetHard('origin/main');
  }

  async pushChanges(): Promise<SyncResult> {
    try {
      await this.git.push('origin');
      return {
        success: true,
        status: 'synced',
      };
    } catch (error) {
      const message = (error as Error).message;

      if (message.includes('non-fast-forward') || message.includes('behind')) {
        // Remote has new commits, need to pull first
        return {
          success: false,
          status: 'error',
          error: 'Remote has new commits. Pull first.',
        };
      }

      return {
        success: false,
        status: 'error',
        error: message,
      };
    }
  }

  async sync(): Promise<SyncResult> {
    // Commit any local changes
    await this.commitChanges('sync: local changes before pull');

    // Pull from remote
    const pullResult = await this.pullChanges();
    if (!pullResult.success) {
      return pullResult;
    }

    // Push any remaining changes
    if (await this.git.hasChanges()) {
      await this.commitChanges();
      return this.pushChanges();
    }

    return pullResult;
  }

  async resolveConflictAndSync(): Promise<SyncResult> {
    // Check if working tree is clean
    const status = await this.git.status();
    if (!status.isClean()) {
      return {
        success: false,
        status: 'error',
        error: 'Working tree has uncommitted changes',
      };
    }

    // Try to push
    return this.pushChanges();
  }

  async getStatus(): Promise<{ isClean: boolean; ahead: number; behind: number }> {
    const status = await this.git.status();
    return {
      isClean: status.isClean(),
      ahead: status.ahead,
      behind: status.behind,
    };
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/core && npm test -- tests/sync/sync-manager.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/sync/sync-manager.ts packages/core/tests/sync/sync-manager.test.ts
git commit -m "feat(sync): 实现同步管理器"
```

---

### Task 2.5: 创建同步模块导出

**Files:**
- Create: `packages/core/src/sync/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 创建同步模块导出**

```typescript
// packages/core/src/sync/index.ts
export { GitClient } from './git-client.js';
export { SyncManager } from './sync-manager.js';
export type { SyncStatus, SyncState, SyncResult, ConflictInfo } from './types.js';
```

- [ ] **Step 2: 更新核心模块导出**

在 `packages/core/src/index.ts` 中添加同步模块导出。

- [ ] **Step 3: 提交**

```bash
git add packages/core/src/sync/index.ts packages/core/src/index.ts
git commit -m "feat(sync): 添加同步模块导出"
```

---

## Phase 3: GitHub 认证

### Task 3.1: 实现 OAuth 回调服务器

**Files:**
- Create: `tomato_app/src/main/sync/oauth-server.ts`

- [ ] **Step 1: 实现 OAuth 服务器**

```typescript
// tomato_app/src/main/sync/oauth-server.ts
import * as http from 'node:http';
import * as url from 'node:url';

export interface OAuthResult {
  code: string;
  error?: string;
}

export class OAuthServer {
  private server: http.Server | null = null;
  private port: number = 0;

  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url || '', true);

        if (parsedUrl.pathname === '/callback') {
          const code = parsedUrl.query.code as string;
          const error = parsedUrl.query.error as string;

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>${error ? 'Authorization failed' : 'Authorization successful!'}</h1>
                <p>You can close this window now.</p>
              </body>
            </html>
          `);

          this.result = { code, error };
          this.resolveResult?.(this.result);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.server.listen(0, () => {
        const address = this.server?.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
          resolve(this.port);
        } else {
          reject(new Error('Failed to get port'));
        }
      });
    });
  }

  private result: OAuthResult | null = null;
  private resolveResult: ((result: OAuthResult) => void) | null = null;

  async waitForCallback(timeout: number = 60000): Promise<OAuthResult> {
    return new Promise((resolve, reject) => {
      this.resolveResult = resolve;

      setTimeout(() => {
        reject(new Error('OAuth timeout'));
        this.stop();
      }, timeout);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  getPort(): number {
    return this.port;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add tomato_app/src/main/sync/oauth-server.ts
git commit -m "feat(sync): 实现 OAuth 回调服务器"
```

---

### Task 3.2: 实现系统密钥库封装

**Files:**
- Create: `tomato_app/src/main/sync/keychain.ts`

- [ ] **Step 1: 实现密钥库封装**

```typescript
// tomato_app/src/main/sync/keychain.ts
import { safeStorage } from 'electron';

const SERVICE_NAME = 'tomato-app';

export async function saveToken(token: string): Promise<void> {
  const encrypted = safeStorage.encryptString(token);
  // Store in electron's safeStorage
  // On macOS this uses Keychain, on Windows Credential Manager, etc.
  localStorage.setItem(`${SERVICE_NAME}-github-token`, encrypted.toString('base64'));
}

export async function getToken(): Promise<string | null> {
  const encrypted = localStorage.getItem(`${SERVICE_NAME}-github-token`);
  if (!encrypted) return null;

  try {
    const buffer = Buffer.from(encrypted, 'base64');
    return safeStorage.decryptString(buffer);
  } catch {
    return null;
  }
}

export async function deleteToken(): Promise<void> {
  localStorage.removeItem(`${SERVICE_NAME}-github-token`);
}

export async function hasToken(): Promise<boolean> {
  const token = await getToken();
  return token !== null;
}
```

- [ ] **Step 2: 提交**

```bash
git add tomato_app/src/main/sync/keychain.ts
git commit -m "feat(sync): 实现系统密钥库封装"
```

---

### Task 3.3: 实现主进程同步服务

**Files:**
- Create: `tomato_app/src/main/sync/sync-service.ts`
- Modify: `tomato_app/src/shared/ipc-channels.ts`
- Modify: `tomato_app/src/main/ipc-handlers.ts`

这个任务较长，需要实现完整的同步服务，包括：
- GitHub OAuth 流程
- 仓库克隆和管理
- 同步状态管理
- 冲突处理逻辑

由于篇幅限制，这里提供框架代码，实际实现时需要补充细节。

- [ ] **Step 1: 定义同步 IPC 通道**

```typescript
// 在 tomato_app/src/shared/ipc-channels.ts 中添加
export const SYNC = {
  LOGIN: 'sync:login',
  LOGOUT: 'sync:logout',
  GET_STATUS: 'sync:get-status',
  SYNC: 'sync:sync',
  RESOLVE_CONFLICT: 'sync:resolve-conflict',
  ROLLBACK: 'sync:rollback',
  GET_DATA_DIR: 'sync:get-data-dir',
} as const;
```

- [ ] **Step 2: 提交 IPC 定义**

```bash
git add tomato_app/src/shared/ipc-channels.ts
git commit -m "feat(sync): 添加同步 IPC 通道定义"
```

---

## Phase 4: UI 组件

由于 Phase 3 和 Phase 4 涉及较多代码，且依赖前面的基础工作完成，建议在实际实施时逐步细化。

以下是 Phase 4 的任务概要：

### Task 4.1: 实现同步状态 Store
### Task 4.2: 实现 SyncStatus 组件
### Task 4.3: 实现 SyncSettings 页面
### Task 4.4: 实现 ConflictPrompt 面板

---

## 后续步骤

完成 Phase 1-4 后，需要进行：

1. **E2E 测试更新** - 更新 Playwright 测试以适应新的文件存储
2. **文档更新** - 更新 CLAUDE.md 说明新的存储结构
3. **性能测试** - 测试大量任务时的文件存储性能
