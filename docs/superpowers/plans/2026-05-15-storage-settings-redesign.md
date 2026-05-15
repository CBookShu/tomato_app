# Storage Split and Settings Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move player-owned data out of `.meta`, split task metadata, group metadata, and task notes into separate files, remove legacy settings compatibility, and reflow the settings page into a compact two-column desktop layout without changing user-facing feature behavior.

**Architecture:** The storage layer will become three player-data buckets (`tasks/`, `groups/`, `notes/`) plus app state in `.meta/`. Notes will be read and written through dedicated main-process IPC instead of piggybacking on task records. Renderer settings code will read canonical keys only, and the settings page will use a responsive grid that fills desktop width instead of a narrow centered column.

**Tech Stack:** TypeScript, Electron main/preload, React, Zustand, Playwright, Vitest, Jest.

---

## File Map

- Core storage and types:
  - `packages/core/src/types/task.ts`
  - `packages/core/src/storage/paths.ts`
  - `packages/core/src/storage/task-file-repo.ts`
  - `packages/core/src/storage/group-file-repo.ts`
  - `packages/core/src/storage/notes-storage.ts`
  - `packages/core/src/storage/file-storage.ts`
  - `packages/core/src/storage/index.ts`
  - `packages/core/src/index.ts`
  - `packages/core/tests/storage/task-file-repo.test.ts`
  - `packages/core/tests/storage/group-file-repo.test.ts`
  - `packages/core/tests/storage/notes-storage.test.ts`
  - `packages/core/tests/storage/file-storage.test.ts`
- Main-process storage wiring and notes IPC:
  - `tomato_app/src/main/database.ts`
  - `tomato_app/src/main/ipc-handlers.ts`
  - `tomato_app/src/shared/ipc-channels.ts`
  - `tomato_app/tests/e2e/basic-acceptance-task-notes.spec.ts`
- Renderer settings compatibility cleanup:
  - `tomato_app/src/renderer/lib/settings-keys.ts`
  - `tomato_app/src/renderer/hooks/useTimer.ts`
  - `tomato_app/src/renderer/hooks/useTimerStart.ts`
  - `tomato_app/src/renderer/hooks/useSound.ts`
  - `tomato_app/src/renderer/components/Settings/SettingsPage.tsx`
  - `tomato_app/tests/lib/settings-keys.test.ts`
  - `tomato_app/tests/e2e/basic-acceptance-settings.spec.ts`
- Settings page layout and spacing:
  - `tomato_app/src/renderer/components/Settings/SettingsPage.tsx`
  - `tomato_app/src/renderer/components/Sync/SyncSettings.tsx`
  - `tomato_app/src/renderer/components/Sync/RepositoryField.tsx`
  - `tomato_app/src/main/App.tsx`
  - `tomato_app/tests/e2e/basic-acceptance-settings-layout.spec.ts`

## Task 1: Split player data storage into tasks, groups, notes, and app state

**Files:**
- Modify: `packages/core/src/types/task.ts`
- Modify: `packages/core/src/storage/paths.ts`
- Modify: `packages/core/src/storage/task-file-repo.ts`
- Modify: `packages/core/src/storage/group-file-repo.ts`
- Modify: `packages/core/src/storage/notes-storage.ts`
- Modify: `packages/core/src/storage/file-storage.ts`
- Modify: `packages/core/src/storage/index.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `tomato_app/src/main/database.ts`
- Test: `packages/core/tests/storage/task-file-repo.test.ts`
- Test: `packages/core/tests/storage/group-file-repo.test.ts`
- Test: `packages/core/tests/storage/notes-storage.test.ts`
- Test: `packages/core/tests/storage/file-storage.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/tests/storage/task-file-repo.test.ts
test('findById ignores legacy notes fields in task yaml', async () => {
  await storage.writeFile(
    'tasks/task-123.yaml',
    [
      'id: task-123',
      'title: Test Task',
      'notes: legacy note content',
      'status: todo',
      'groupId: default',
      'completedPomodoros: 0',
      'createdAt: 2026-05-10T10:00:00Z',
      'updatedAt: 2026-05-10T10:00:00Z',
    ].join('\n'),
  );

  await expect(repo.findById('task-123')).resolves.toEqual({
    id: 'task-123',
    title: 'Test Task',
    description: undefined,
    completedPomodoros: 0,
    status: 'todo',
    groupId: 'default',
    lastPomodoroTime: undefined,
    tags: undefined,
    createdAt: '2026-05-10T10:00:00Z',
    updatedAt: '2026-05-10T10:00:00Z',
    completedAt: undefined,
  });
});
```

```ts
// packages/core/tests/storage/notes-storage.test.ts
test('saveNotes writes markdown files under notes/', async () => {
  await notes.saveNotes('task-123', 'My notes');
  await expect(storage.readFile('notes/task-123.md')).resolves.toBe('My notes');
});
```

```ts
// packages/core/tests/storage/group-file-repo.test.ts
test('create writes group files under groups/', async () => {
  const group = {
    id: 'group-a',
    name: 'Group A',
    taskOrder: [],
    createdAt: '2026-05-10T10:00:00Z',
    updatedAt: '2026-05-10T10:00:00Z',
  };

  await repo.create(group);

  await expect(storage.readFile('groups/group-a.yaml')).resolves.toContain('name: Group A');
});
```

```ts
// packages/core/tests/storage/file-storage.test.ts
test('clearAll removes tasks, groups, notes, and current meta data', async () => {
  await storage.writeFile('tasks/task-1.yaml', 'id: task-1\n');
  await storage.writeFile('groups/group-1.yaml', 'id: group-1\n');
  await storage.writeFile('notes/task-1.md', '# notes\n');
  await storage.writeFile('.meta/config.yaml', 'pomodoroDuration: 25\n');

  await storage.clearAll();

  await expect(storage.fileExists('tasks/task-1.yaml')).resolves.toBe(false);
  await expect(storage.fileExists('groups/group-1.yaml')).resolves.toBe(false);
  await expect(storage.fileExists('notes/task-1.md')).resolves.toBe(false);
  await expect(storage.fileExists('.meta/config.yaml')).resolves.toBe(false);
});
```

- [ ] **Step 2: Run the storage tests and confirm they fail before the code change**

Run:

```bash
cd packages/core && npm test -- tests/storage/task-file-repo.test.ts tests/storage/group-file-repo.test.ts tests/storage/notes-storage.test.ts tests/storage/file-storage.test.ts
```

Expected: FAIL because task/group paths still point at `.meta`, notes still use `tasks/`, and `clearAll()` does not yet cover the new `notes/` directory.

- [ ] **Step 3: Implement the minimal storage split**

```ts
// packages/core/src/types/task.ts
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly completedPomodoros: number;
  readonly status: TaskStatus;
  readonly groupId?: string;
  readonly lastPomodoroTime?: string;
  readonly tags?: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface NewTask {
  readonly title: string;
  readonly description?: string;
  readonly groupId?: string;
  readonly tags?: readonly string[];
}
```

```ts
// packages/core/src/storage/paths.ts
export interface StoragePaths {
  base: string;
  meta: string;
  tasks: string;
  groups: string;
  notes: string;
  stats: string;
}

export function getStoragePaths(baseDir: string): StoragePaths {
  return {
    base: baseDir,
    meta: `${baseDir}/.meta`,
    tasks: `${baseDir}/tasks`,
    groups: `${baseDir}/groups`,
    notes: `${baseDir}/notes`,
    stats: `${baseDir}/stats`,
  };
}

export function getTaskPath(baseDir: string, taskId: string): string {
  return `${baseDir}/tasks/${taskId}.yaml`;
}

export function getGroupPath(baseDir: string, groupId: string): string {
  return `${baseDir}/groups/${groupId}.yaml`;
}

export function getNotesPath(baseDir: string, taskId: string): string {
  return `${baseDir}/notes/${taskId}.md`;
}
```

```ts
// packages/core/src/storage/task-file-repo.ts
interface TaskYaml {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'completed';
  groupId?: string;
  completedPomodoros: number;
  lastPomodoroTime?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

```ts
// packages/core/src/storage/notes-storage.ts
export class NotesStorage {
  async getNotes(taskId: string): Promise<string | null> {
    return this.storage.readFile(getNotesPath('', taskId).replace(/^\//, ''));
  }

  async saveNotes(taskId: string, content: string): Promise<void> {
    const path = getNotesPath('', taskId).replace(/^\//, '');
    if (!content.trim()) {
      await this.storage.deleteFile(path);
      return;
    }
    await this.storage.writeFile(path, content);
  }
}
```

```ts
// tomato_app/src/main/database.ts
await fs.mkdir(paths.meta, { recursive: true });
await fs.mkdir(paths.tasks, { recursive: true });
await fs.mkdir(paths.groups, { recursive: true });
await fs.mkdir(paths.notes, { recursive: true });
await fs.mkdir(paths.stats, { recursive: true });
```

```ts
// packages/core/src/storage/file-storage.ts
async clearAll(): Promise<void> {
  const subdirs = ['.meta', 'tasks', 'groups', 'notes', 'stats', 'meta', 'groups', 'tasks-notes'];
  for (const subdir of subdirs) {
    await fs.rm(path.join(this.baseDir, subdir), { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Run the storage tests again and confirm the new layout passes**

Run:

```bash
cd packages/core && npm test -- tests/storage/task-file-repo.test.ts tests/storage/group-file-repo.test.ts tests/storage/notes-storage.test.ts tests/storage/file-storage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the storage split**

```bash
git add packages/core/src/types/task.ts packages/core/src/storage/paths.ts packages/core/src/storage/task-file-repo.ts packages/core/src/storage/group-file-repo.ts packages/core/src/storage/notes-storage.ts packages/core/src/storage/file-storage.ts packages/core/src/storage/index.ts packages/core/src/index.ts tomato_app/src/main/database.ts packages/core/tests/storage/task-file-repo.test.ts packages/core/tests/storage/group-file-repo.test.ts packages/core/tests/storage/notes-storage.test.ts packages/core/tests/storage/file-storage.test.ts
git commit -m "feat(storage): split tasks groups and notes"
```

## Task 2: Move task-note editing to dedicated notes IPC

**Files:**
- Modify: `tomato_app/src/shared/ipc-channels.ts`
- Modify: `tomato_app/src/main/ipc-handlers.ts`
- Modify: `tomato_app/src/renderer/components/TaskList/TaskDetail.tsx`
- Modify: `tomato_app/src/renderer/lib/task-notes.ts`
- Modify: `tomato_app/tests/e2e/basic-acceptance-task-notes.spec.ts`

- [ ] **Step 1: Write the failing acceptance test for notes persistence through the new IPC path**

```ts
// tomato_app/tests/e2e/basic-acceptance-task-notes.spec.ts
test('任务重命名与笔记编辑在刷新后应持久化', async ({ page }) => {
  await createDefaultTask(page, '验收任务：写测试');

  const taskItem = page.getByTestId('task-item').filter({ hasText: '验收任务：写测试' }).first();
  await taskItem.click();

  const notesEditor = page.locator('textarea[placeholder="添加笔记..."]');
  await notesEditor.fill('## 验收笔记\n\n- 独立 notes 文件');

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('tab', { name: '任务' }).click();
  await page.getByTestId('task-item').filter({ hasText: '验收任务：写测试' }).first().click();

  await expect(page.locator('textarea[placeholder="添加笔记..."]')).toHaveValue(/独立 notes 文件/);
});
```

- [ ] **Step 2: Run the acceptance test and confirm it fails before the IPC wiring exists**

Run:

```bash
cd tomato_app && npm run build:main && npm test -- tests/e2e/basic-acceptance-task-notes.spec.ts
```

Expected: FAIL because `TaskDetail` still saves notes through `TASK_EDIT` and the notes file is not yet read/written through a dedicated IPC channel.

- [ ] **Step 3: Implement the notes IPC and TaskDetail read/write flow**

```ts
// tomato_app/src/shared/ipc-channels.ts
[IPC.TASK_NOTES_GET]: { request: { taskId: string }; response: string | null };
[IPC.TASK_NOTES_SET]: { request: { taskId: string; content: string }; response: void };
[IPC.TASK_NOTES_DELETE]: { request: { taskId: string }; response: void };
```

```ts
// tomato_app/src/main/ipc-handlers.ts
ipcMain.handle(IPC.TASK_NOTES_GET, async (_e, payload) => getNotesStorage().getNotes(payload.taskId));
ipcMain.handle(IPC.TASK_NOTES_SET, async (_e, payload) => getNotesStorage().saveNotes(payload.taskId, payload.content));
ipcMain.handle(IPC.TASK_NOTES_DELETE, async (_e, payload) => getNotesStorage().deleteNotes(payload.taskId));
```

```ts
// tomato_app/src/renderer/components/TaskList/TaskDetail.tsx
useEffect(() => {
  async function loadNotes() {
    if (!task) {
      setNotes('');
      setLastSavedNotes(null);
      return;
    }

    const content = await invoke(IPC.TASK_NOTES_GET, { taskId: task.id });
    const normalized = normalizeTaskNotes(content);
    setNotes(normalized);
    setLastSavedNotes(normalized);
  }

  void loadNotes();
}, [task?.id, invoke]);

const handleSaveNotes = useCallback(async (taskId: string, value: string) => {
  setIsSaving(true);
  setSaveError(null);
  try {
    await invoke(IPC.TASK_NOTES_SET, { taskId, content: value });
    setLastSavedNotes(value);
  } catch (error) {
    console.error('Failed to save notes:', error);
    setSaveError('保存失败');
  } finally {
    setIsSaving(false);
  }
}, [invoke]);
```

```ts
// tomato_app/src/renderer/lib/task-notes.ts
export function normalizeTaskNotes(notes?: string | null): string {
  return notes ?? '';
}
```

- [ ] **Step 4: Run the main build and the notes acceptance test again**

Run:

```bash
cd tomato_app && npm run build:main && npm test -- tests/e2e/basic-acceptance-task-notes.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the notes IPC wiring**

```bash
git add tomato_app/src/shared/ipc-channels.ts tomato_app/src/main/ipc-handlers.ts tomato_app/src/renderer/components/TaskList/TaskDetail.tsx tomato_app/src/renderer/lib/task-notes.ts tomato_app/tests/e2e/basic-acceptance-task-notes.spec.ts
git commit -m "feat(notes): move task notes to dedicated ipc"
```

## Task 3: Remove legacy settings compatibility and keep only canonical keys

**Files:**
- Modify: `tomato_app/src/renderer/lib/settings-keys.ts`
- Modify: `tomato_app/src/renderer/hooks/useTimer.ts`
- Modify: `tomato_app/src/renderer/hooks/useTimerStart.ts`
- Modify: `tomato_app/src/renderer/hooks/useSound.ts`
- Modify: `tomato_app/src/renderer/components/Settings/SettingsPage.tsx`
- Modify: `tomato_app/tests/lib/settings-keys.test.ts`
- Modify: `tomato_app/tests/e2e/basic-acceptance-settings.spec.ts`

- [ ] **Step 1: Write the failing unit test that proves legacy keys are ignored**

```ts
// tomato_app/tests/lib/settings-keys.test.ts
test('readSetting ignores legacy keys when the canonical key is missing', () => {
  const settings = {
    pomodoro_duration: '31',
  };

  expect(readSetting(settings, 'pomodoroDuration', '25')).toBe('25');
});
```

```ts
// tomato_app/tests/e2e/basic-acceptance-settings.spec.ts
test('legacy settings keys do not override canonical settings on load', async ({ page }) => {
  await page.evaluate(async ({ settingsSetChannel }) => {
    await window.electronAPI.invoke(settingsSetChannel, { key: 'pomodoro_duration', value: '31' });
  }, { settingsSetChannel: IPC.SETTINGS_SET });

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('tab', { name: '设置' }).click();

  await expect(page.getByText('番茄时长 (分钟)').locator('..').getByRole('spinbutton')).toHaveValue('25');
});
```

- [ ] **Step 2: Run the settings tests and confirm the legacy path still affects the UI**

Run:

```bash
cd tomato_app && npm test -- tests/lib/settings-keys.test.ts tests/e2e/basic-acceptance-settings.spec.ts
```

Expected: FAIL because `readSetting()` and `normalizeSettings()` still look at legacy keys, and `SettingsPage` still removes them on write.

- [ ] **Step 3: Replace legacy-aware helpers with canonical-only reads**

```ts
// tomato_app/src/renderer/lib/settings-keys.ts
export type CanonicalSettingKey =
  | 'pomodoroDuration'
  | 'shortBreakDuration'
  | 'longBreakDuration'
  | 'longBreakInterval'
  | 'soundEnabled'
  | 'notificationEnabled'
  | 'darkMode'
  | 'autoStart';

export function readSetting(
  settings: Record<string, string>,
  key: CanonicalSettingKey,
  fallback: string,
): string {
  return settings[key] ?? fallback;
}
```

```ts
// tomato_app/src/renderer/hooks/useTimer.ts
const duration = parseInt(readSetting(settings, 'pomodoroDuration', '25'), 10);
```

```ts
// tomato_app/src/renderer/hooks/useTimerStart.ts
const duration = parseInt(readSetting(settings, 'pomodoroDuration', '25'), 10);
```

```ts
// tomato_app/src/renderer/hooks/useSound.ts
const soundEnabled = useSettingsStore((s) => readSetting(s.settings, 'soundEnabled', 'true') !== 'false');
```

```ts
// tomato_app/src/renderer/components/Settings/SettingsPage.tsx
import type { CanonicalSettingKey } from '@/lib/settings-keys.js';

const { settings, setAll, set } = useSettingsStore();

useEffect(() => {
  async function load() {
    const all = await invoke(IPC.SETTINGS_GET_ALL);
    if (all) setAll(all);
    setLoaded(true);
  }
  load();
}, [invoke, setAll]);
```

```ts
// tomato_app/src/renderer/components/Settings/SettingsPage.tsx
const updateKey = async (key: CanonicalSettingKey, value: string) => {
  set(key, value);
  await invoke(IPC.SETTINGS_SET, { key, value });
};
```

- [ ] **Step 4: Run the settings tests again and confirm canonical-only behavior passes**

Run:

```bash
cd tomato_app && npm test -- tests/lib/settings-keys.test.ts tests/e2e/basic-acceptance-settings.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the compatibility cleanup**

```bash
git add tomato_app/src/renderer/lib/settings-keys.ts tomato_app/src/renderer/hooks/useTimer.ts tomato_app/src/renderer/hooks/useTimerStart.ts tomato_app/src/renderer/hooks/useSound.ts tomato_app/src/renderer/components/Settings/SettingsPage.tsx tomato_app/tests/lib/settings-keys.test.ts tomato_app/tests/e2e/basic-acceptance-settings.spec.ts
git commit -m "refactor(settings): remove legacy key compatibility"
```

## Task 4: Reflow the settings page into a compact two-column desktop layout

**Files:**
- Modify: `tomato_app/src/main/App.tsx`
- Modify: `tomato_app/src/renderer/components/Settings/SettingsPage.tsx`
- Modify: `tomato_app/src/renderer/components/Sync/SyncSettings.tsx`
- Modify: `tomato_app/src/renderer/components/Sync/RepositoryField.tsx`
- Modify: `tomato_app/tests/e2e/basic-acceptance-settings.spec.ts`

- [ ] **Step 1: Write the failing layout test**

```ts
// tomato_app/tests/e2e/basic-acceptance-settings-layout.spec.ts
test('settings page uses a compact two-column desktop layout', async ({ page }) => {
  await page.getByRole('tab', { name: '设置' }).click();

  const layout = page.getByTestId('settings-layout');
  await expect(layout).toHaveCSS('display', 'grid');
  await expect(layout).toHaveCSS('grid-template-columns', /.+ .+/);

  await expect(page.getByRole('button', { name: '导出数据' })).toHaveCSS('white-space', 'nowrap');
  await expect(page.getByRole('button', { name: '导入数据' })).toHaveCSS('white-space', 'nowrap');
});
```

- [ ] **Step 2: Run the layout test and confirm it fails before the CSS and markup change**

Run:

```bash
cd tomato_app && npm test -- tests/e2e/basic-acceptance-settings-layout.spec.ts
```

Expected: FAIL because the settings page still renders as a narrow centered column and the buttons can wrap.

- [ ] **Step 3: Rework the page shell and card layout**

```tsx
// tomato_app/src/main/App.tsx
case 'settings':
  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <SettingsPage />
    </div>
  );
```

```tsx
// tomato_app/src/renderer/components/Settings/SettingsPage.tsx
return (
  <div data-testid="settings-layout" className="mx-auto grid w-full max-w-6xl gap-4 px-4 lg:grid-cols-2">
    <div className="space-y-4">
      <Card>{/* 计时设置 card JSX stays unchanged */}</Card>
      <Card>{/* 通知设置 card JSX stays unchanged */}</Card>
      <Card>{/* 外观 card JSX stays unchanged */}</Card>
    </div>
    <div className="space-y-4">
      <Card>{/* 数据同步 card JSX stays unchanged */}</Card>
      <Card>{/* 高级 card JSX stays unchanged */}</Card>
      <Card>{/* 数据管理 card JSX stays unchanged */}</Card>
    </div>
  </div>
);
```

```tsx
// tomato_app/src/renderer/components/Sync/SyncSettings.tsx
return (
  <div className="space-y-3">
    <p className="text-xs text-gray-500 dark:text-gray-400">
      先确认本机已经可以访问目标 Git 远程，然后填写远程地址和目标分支完成绑定。
    </p>
    <RepositoryField
      remoteUrl={remoteUrl}
      remoteBranch={remoteBranch}
      onRemoteUrlChange={setRemoteUrl}
      onRemoteBranchChange={setRemoteBranch}
      onSubmit={handleBind}
      disabled={status === 'syncing'}
    />
    {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
    <SyncBindingStatus />
    <SyncStatus />
    {dataDir && (
      <code className="block break-all rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
        {dataDir}
      </code>
    )}
  </div>
);
```

```tsx
// tomato_app/src/renderer/components/Sync/RepositoryField.tsx
<form onSubmit={handleSubmit} className="space-y-3">
  <div className="space-y-2">
    <Label htmlFor="remote-url">远程地址</Label>
    <Input
      id="remote-url"
      value={remoteUrl}
      onChange={(event) => onRemoteUrlChange(event.target.value)}
      placeholder="https://github.com/<owner>/<repo>.git"
      disabled={disabled}
      autoCapitalize="off"
      autoComplete="off"
      spellCheck={false}
      className="w-full"
    />
  </div>
  <div className="space-y-2">
    <Label htmlFor="remote-branch">目标分支</Label>
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        id="remote-branch"
        value={remoteBranch}
        onChange={(event) => onRemoteBranchChange(event.target.value)}
        placeholder="main"
        disabled={disabled}
        autoCapitalize="off"
        autoComplete="off"
        spellCheck={false}
        className="flex-1"
      />
      <Button type="submit" className="whitespace-nowrap" disabled={disabled}>
        绑定远程
      </Button>
    </div>
  </div>
</form>
```

- [ ] **Step 4: Run the layout test again and confirm the page is compact and non-wrapping**

Run:

```bash
cd tomato_app && npm test -- tests/e2e/basic-acceptance-settings.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the settings layout update**

```bash
git add tomato_app/src/main/App.tsx tomato_app/src/renderer/components/Settings/SettingsPage.tsx tomato_app/src/renderer/components/Sync/SyncSettings.tsx tomato_app/src/renderer/components/Sync/RepositoryField.tsx tomato_app/tests/e2e/basic-acceptance-settings-layout.spec.ts
git commit -m "feat(settings): compact desktop layout"
```

## Self-Review Checklist

- [ ] Every storage family in the spec is covered: `tasks/`, `groups/`, `notes/`, and `.meta/`
- [ ] The plan removes legacy settings compatibility instead of preserving it
- [ ] The notes flow no longer depends on `Task.notes`
- [ ] Settings layout changes do not introduce new functionality
- [ ] Every task has a failing test step, an implementation step, a verification step, and a commit step
- [ ] There are no placeholders such as TODO or TBD
- [ ] Command paths match the repo scripts (`packages/core` uses Jest, `tomato_app` uses Vitest and Playwright)
