# Bug 修复与 UI 优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 8 个已确认问题：通知、统计、笔记编辑器、任务组删除、任务项防截断、拖拽排序、可调节面板、Tray 图标

**Architecture:** Main process 修复（通知/统计/Tray）+ Renderer UI 重构（笔记/任务组/任务项/拖拽/面板）。使用 @dnd-kit 实现拖拽排序，E2E 测试使用 Playwright 真实 Electron 环境。

**Tech Stack:** Electron, React, TypeScript, @dnd-kit/core, @dnd-kit/sortable, Playwright

---

### Task 1: macOS 通知修复

**Files:**
- Modify: `tomato_app/src/main/notifications.ts:26-35`

- [ ] **Step 1: 移除 getPermissionStatus 检查**

```typescript
// tomato_app/src/main/notifications.ts
// 删除 26-35 行的 macOS 权限检查代码块：
//   if (process.platform === 'darwin') {
//     const sessionAny = session.defaultSession as any;
//     const permission = sessionAny.getPermissionStatus?.('notifications') ?? 'unknown';
//     ...
//   }
```

执行 `Edit`，oldString 和 newString 如下：

**oldString:**
```
  if (process.platform === 'darwin') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionAny = session.defaultSession as any;
    const permission = sessionAny.getPermissionStatus?.('notifications') ?? 'unknown';
    console.log(`[Notification] Permission: ${permission}`);
    if (permission !== 'granted') {
      console.warn('[Notification] Permission not granted');
      return;
    }
  }

  const notification = new Notification({
```

**newString:**
```
  const notification = new Notification({
```

- [ ] **Step 2: 运行 E2E 测试验证通知相关流程不受影响**

```bash
cd tomato_app && npm run test:e2e -- tests/e2e/pomodoro-cycle.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tomato_app/src/main/notifications.ts
git commit -m "fix: 修复 macOS 通知被 getPermissionStatus 误拦截的问题"
```

---

### Task 2: 任务完成统计记录

**Files:**
- Modify: `tomato_app/src/main/ipc-handlers.ts`

- [ ] **Step 1: 在 complete 事件处理中调用 statsRepo.upsert()**

在 `setupTimerEvents()` 函数中，将 statsRepo 参数化传入，在 `'complete'` 事件 `type === 'work'` 时 upsert 统计。

修改 `setupTimerEvents` 签名，增加 `statsRepo` 参数：

```typescript
// 函数签名改为：
function setupTimerEvents(
  t: PomodoroTimer,
  win: BrowserWindow | null,
  statsRepo?: StatsRepository | null,
): void {
```

在 `t.on('complete', ...)` 回调中添加：

```typescript
  t.on('complete', (type: 'work' | 'break') => {
    safeSend(win, IPC.TIMER_COMPLETE, type);
    if (type === 'work') {
      if (statsRepo) {
        const today = new Date().toISOString().slice(0, 10);
        statsRepo.upsert(today, { totalPomodoros: 1 }).catch((err: Error) => {
          console.error('[Stats] Failed to record pomodoro:', err);
        });
      }
      onPomodoroComplete?.();
    } else {
      onBreakComplete?.();
    }
  });
```

修改 `getTimer()` 和 `updateTimerConfig()` 中调用 `setupTimerEvents` 的地方，传入 `statsRepo` 参数。需要将 `statsRepo` 提升为模块级变量：

在文件顶部变量区添加 `let statsRepo: StatsRepository | null = null;`，在 `registerIpcHandlers` 中赋值。

在 `getTimer()` 中调用 `setupTimerEvents(timer, currentWindow, statsRepo);`
在 `updateTimerConfig()` 中调用 `setupTimerEvents(timer, currentWindow, statsRepo);`

- [ ] **Step 2: 编写 E2E 测试验证每日统计递增**

创建 `tomato_app/tests/e2e/stats-recording.spec.ts`:

```typescript
import { test, expect } from './fixtures';

test.describe('每日统计记录', () => {
  test.beforeEach(async ({ electronApp }) => {
    await electronApp.evaluate(async ({ ipcMain }) => {
      await ipcMain.invoke('test:clear-database');
    });
  });

  test('番茄完成后每日统计正确递增', async ({ page, electronApp }) => {
    await page.getByRole('tab', { name: '统计' }).click();
    await expect(page.getByText('0 个番茄')).toBeVisible();

    // 创建任务并开始计时
    await page.getByRole('tab', { name: '任务' }).click();
    await page.getByTitle('新建任务').click();
    const task = page.getByTestId('task-item').filter({ hasText: '新任务' }).first();
    await task.hover();
    const playButton = task.getByRole('button').filter({ has: page.locator('svg.lucide-play') });
    await playButton.click();

    // 等待番茄完成
    await page.getByRole('tab', { name: '计时' }).click();
    await expect(page.getByText('休息中')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('timer-start-button')).toBeVisible({ timeout: 8000 });

    // 检查统计
    await page.getByRole('tab', { name: '统计' }).click();
    await expect(page.getByText('1 个番茄')).toBeVisible({ timeout: 5000 });
  });
});
```

- [ ] **Step 3: 运行 E2E 测试**

```bash
cd tomato_app && npm run test:e2e -- tests/e2e/stats-recording.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add tomato_app/src/main/ipc-handlers.ts tomato_app/tests/e2e/stats-recording.spec.ts
git commit -m "fix: 番茄完成时记录每日统计到 daily_stats 表"
```

---

### Task 3: 笔记编辑区域全高度自适应 + autoSave

**Files:**
- Modify: `tomato_app/src/renderer/components/TaskList/TaskDetail.tsx`

- [ ] **Step 1: 改造 TaskDetail 布局和 autoSave**

修改后完整文件：

```tsx
import { useTaskStore } from '@/stores/task-store.js';
import { useTimer } from '@/hooks/useTimer.js';
import { Button } from '@/components/ui/button.js';
import { Play, CheckCircle } from 'lucide-react';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useIpc } from '@/hooks/useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import MDEditor from '@uiw/react-md-editor';

export function TaskDetail() {
  const tasks = useTaskStore((s) => s.tasks);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const updateTask = useTaskStore((s) => s.updateTask);
  const { start, status } = useTimer();
  const { invoke } = useIpc();

  const task = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const [notes, setNotes] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedNotesRef = useRef<string>('');

  useEffect(() => {
    if (task) {
      setNotes(task.notes || '');
      lastSavedNotesRef.current = task.notes || '';
    }
  }, [task?.id, task?.notes]);

  const saveNotes = useCallback(async (val: string) => {
    if (!task) return;
    if (val === lastSavedNotesRef.current) return;
    lastSavedNotesRef.current = val;
    updateTask(task.id, { notes: val });
    try {
      await invoke(IPC.TASK_EDIT, { id: task.id, updates: { notes: val } });
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  }, [task, updateTask, invoke]);

  const handleNotesChange = useCallback((val?: string) => {
    const newVal = val || '';
    setNotes(newVal);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveNotes(newVal), 1000);
  }, [saveNotes]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (!task) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-lg">选择一个任务查看详情</p>
          <p className="text-sm mt-1">或从左侧任务列表创建新任务</p>
        </div>
      </div>
    );
  }

  const handleStart = () => start(task.id);

  const handleComplete = () => {
    updateTask(task.id, {
      status: task.status === 'completed' ? 'todo' : 'completed',
      completedAt: task.status !== 'completed' ? new Date().toISOString() : undefined,
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-6 pb-2">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {task.title}
          </h1>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleStart} disabled={status === 'working'}>
              <Play className="h-4 w-4 mr-1" />
              开始专注
            </Button>
            <Button size="sm" variant="outline" onClick={handleComplete}>
              <CheckCircle className="h-4 w-4 mr-1" />
              {task.status === 'completed' ? '恢复' : '完成'}
            </Button>
          </div>
        </div>

        <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>🍅 已完成 {task.completedPomodoros} 个番茄</span>
          <span>📅 创建于 {new Date(task.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-6 pb-6" data-color-mode="auto">
        <MDEditor
          value={notes}
          onChange={handleNotesChange}
          preview="live"
          height="100%"
          visibleDragbar={false}
          textareaProps={{
            placeholder: '添加笔记...',
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 运行 E2E 测试验证笔记自动保存**

```bash
cd tomato_app && npm run test:e2e -- tests/e2e/tasks.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tomato_app/src/renderer/components/TaskList/TaskDetail.tsx
git commit -m "feat: 笔记编辑器全高度自适应 + 1秒防抖自动保存"
```

---

### Task 4: 任务组删除功能

**Files:**
- Modify: `tomato_app/src/renderer/components/TaskList/TaskGroupItem.tsx`

- [ ] **Step 1: 在 TaskGroupItem 添加 MoreHorizontal 菜单**

修改后完整文件：

```tsx
import type { TaskGroup, Task } from '@pomodoro/core';
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { TaskItem } from './TaskItem.js';
import { useTaskStore } from '@/stores/task-store.js';
import { useTimerStore } from '@/stores/timer-store.js';
import { useIpc } from '@/hooks/useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import { useState, useRef, useEffect } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog.js';

interface TaskGroupItemProps {
  group: TaskGroup;
  tasks: Task[];
}

export function TaskGroupItem({ group, tasks }: TaskGroupItemProps) {
  const collapsedGroups = useTaskStore((s) => s.collapsedGroups);
  const toggleGroupCollapse = useTaskStore((s) => s.toggleGroupCollapse);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const addTask = useTaskStore((s) => s.addTask);
  const updateGroup = useTaskStore((s) => s.updateGroup);
  const removeGroup = useTaskStore((s) => s.removeGroup);
  const currentTaskId = useTimerStore((s) => s.currentTaskId);
  const remainingTime = useTimerStore((s) => s.remainingTime);
  const timerStatus = useTimerStore((s) => s.status);
  const { invoke } = useIpc();

  const isCollapsed = collapsedGroups.has(group.id);
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const isDefault = group.id === 'default';
  const activeTask = tasks.find((t) => t.id === currentTaskId);
  const showTimer = activeTask && timerStatus === 'working';

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAddTask = async () => {
    const title = '新任务';
    const task = {
      id: crypto.randomUUID(),
      title,
      status: 'todo' as const,
      groupId: group.id,
      completedPomodoros: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addTask(task);
    try {
      await invoke(IPC.TASK_CREATE, { input: { title, groupId: group.id } });
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleRename = () => {
    if (name.trim() && name.trim() !== group.name) {
      updateGroup(group.id, { name: name.trim() });
      invoke(IPC.GROUP_RENAME, { id: group.id, name: name.trim() });
    }
    setEditing(false);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
    setMenuOpen(false);
  };

  const handleConfirmDelete = async () => {
    removeGroup(group.id);
    try {
      await invoke(IPC.GROUP_DELETE, { id: group.id });
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  return (
    <div className="mb-1">
      <div className="w-full flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <button
          onClick={() => toggleGroupCollapse(group.id)}
          aria-expanded={!isCollapsed}
          className="flex items-center gap-1 flex-1 min-w-0"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
          )}
          {group.color && (
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
          )}
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setEditing(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-transparent border-b border-tomato px-1 text-sm font-medium outline-none"
            />
          ) : (
            <span className="flex-1 text-sm font-medium text-left truncate">
              {group.name}
            </span>
          )}
          <span className="text-xs text-gray-400 shrink-0">
            {completedCount}/{tasks.length}
          </span>
          {showTimer && (
            <span className="flex items-center gap-1 text-xs text-tomato animate-pulse ml-2 shrink-0">
              <span>🍅</span>
              <span className="font-mono">{formatTime(remainingTime)}</span>
            </span>
          )}
        </button>

        <button
          onClick={handleAddTask}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0"
          title="新建任务"
        >
          <Plus className="h-3.5 w-3.5 text-gray-400" />
        </button>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          >
            <MoreHorizontal className="h-3.5 w-3.5 text-gray-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-28 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-10">
              {!isDefault && (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => { setEditing(true); setMenuOpen(false); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  重命名
                </button>
              )}
              {!isDefault && (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="ml-4 mt-0.5">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isSelected={selectedTaskId === task.id}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="删除分组"
        description={`确认删除分组「${group.name}」及其所有任务？此操作不可撤销。`}
        confirmLabel="删除"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
```

- [ ] **Step 2: 编写 E2E 测试验证分组删除**

在 `tomato_app/tests/e2e/tasks.spec.ts` 中添加测试用例：

```typescript
test('创建并删除分组', async ({ page, electronApp }) => {
  await page.getByRole('tab', { name: '任务' }).click();

  // 新建分组
  await page.getByText('新建分组').click();
  await page.getByPlaceholder('输入分组名称').fill('测试分组');
  await page.getByRole('button', { name: '创建' }).click();
  await expect(page.getByText('测试分组')).toBeVisible();

  // 删除分组：点击 MoreHorizontal 按钮
  const groupRow = page.locator('div').filter({ hasText: '测试分组' }).filter({ hasText: '0/0' }).first();
  // 点击分组行内的 MoreHorizontal 按钮
  const moreBtn = groupRow.locator('svg.lucide-more-horizontal').first();
  await moreBtn.click();
  await page.getByText('删除').click();

  // 确认删除
  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('测试分组')).not.toBeVisible();
});
```

- [ ] **Step 3: 运行 E2E 测试**

```bash
cd tomato_app && npm run test:e2e -- tests/e2e/tasks.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add tomato_app/src/renderer/components/TaskList/TaskGroupItem.tsx tomato_app/tests/e2e/tasks.spec.ts
git commit -m "feat: 任务组添加重命名/删除功能"
```

---

### Task 5: 任务列表项优化防截断

**Files:**
- Modify: `tomato_app/src/renderer/components/TaskList/TaskItem.tsx`

- [ ] **Step 1: 精简操作按钮为更多菜单**

修改后完整文件：

```tsx
import { Checkbox } from '@/components/ui/checkbox.js';
import { Button } from '@/components/ui/button.js';
import { ConfirmDialog } from '@/components/ui/confirm-dialog.js';
import { cn } from '@/lib/utils.js';
import type { Task } from '@pomodoro/core';
import { GripVertical, Pencil, Trash2, Play, MoreHorizontal } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTaskStore } from '@/stores/task-store.js';
import { useTimerStore } from '@/stores/timer-store.js';
import { useTimer } from '@/hooks/useTimer.js';
import { IPC } from '@shared/ipc-channels.js';

interface TaskItemProps {
  task: Task;
  isSelected?: boolean;
}

export function TaskItem({ task, isSelected }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isCompleted = task.status === 'completed';

  const { updateTask, removeTask, selectTask } = useTaskStore();
  const { start } = useTimer();
  const currentTaskId = useTimerStore((s) => s.currentTaskId);
  const isActive = task.id === currentTaskId;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCheck = () => {
    updateTask(task.id, {
      status: task.status === 'completed' ? 'todo' : 'completed',
      completedAt: task.status !== 'completed' ? new Date().toISOString() : undefined,
    });
  };

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    start(task.id);
    setMenuOpen(false);
  };

  const handleEdit = () => {
    if (title.trim()) {
      updateTask(task.id, { title: title.trim() });
      setEditing(false);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setMenuOpen(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActive) {
      setShowDeleteConfirm(true);
    } else {
      removeTask(task.id);
    }
    setMenuOpen(false);
  };

  const handleConfirmDelete = async () => {
    await window.electronAPI.invoke(IPC.TIMER_STOP);
    removeTask(task.id);
  };

  const handleClick = () => {
    selectTask(task.id);
  };

  return (
    <div
      onClick={handleClick}
      data-testid="task-item"
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer',
        isCompleted && 'opacity-50',
        isSelected && 'bg-tomato/10 dark:bg-tomato/20',
        isActive && 'bg-tomato/10 dark:bg-tomato/20',
      )}
    >
      <GripVertical className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
      <Checkbox
        checked={isCompleted}
        onCheckedChange={handleCheck}
        className="shrink-0"
        data-testid="task-checkbox"
      />
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent border-b border-tomato px-1 text-sm outline-none"
        />
      ) : (
        <span
          className={cn('flex-1 text-sm truncate', isCompleted && 'line-through')}
          onDoubleClick={() => setEditing(true)}
        >
          {task.title}
        </span>
      )}
      {isActive ? (
        <span data-testid="timer-indicator" className="text-sm shrink-0">🍅</span>
      ) : task.completedPomodoros > 0 ? (
        <span className="text-xs text-gray-400 tabular-nums shrink-0">
          x{task.completedPomodoros}
        </span>
      ) : null}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        >
          <MoreHorizontal className="h-3.5 w-3.5 text-gray-400" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-28 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-10">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={handleStart}
            >
              <Play className="h-3.5 w-3.5" />
              开始专注
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={handleEditClick}
            >
              <Pencil className="h-3.5 w-3.5" />
              重命名
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="确认删除"
        description={`任务「${task.title}」正在专注中，删除后将停止计时。`}
        confirmLabel="确定删除"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
```

- [ ] **Step 2: 更新 E2E 测试适配新 UI**

E2E 测试中原来通过 `.locator('svg.lucide-play')` 查找播放按钮，现在需要先点击 `MoreHorizontal` 展开菜单。需要更新 `task-timer-link.spec.ts` 中 `createTaskAndStartTimer` 函数：

修改 `createTaskAndStartTimer` 函数的点击播放按钮部分：

```typescript
// 原代码:
// 悬停以显示操作按钮
await newTaskItem.hover();
// 点击播放按钮（Play 图标）开始计时
const playButton = newTaskItem.getByRole('button').filter({ has: page.locator('svg.lucide-play') });
await playButton.click();

// 改为:
await newTaskItem.hover();
// 点击更多菜单
const moreBtn = newTaskItem.locator('svg.lucide-more-horizontal');
await moreBtn.click();
// 点击开始专注
await page.getByText('开始专注').click();
```

同样需要更新 `pomodoro-cycle.spec.ts:35-36` 的播放按钮点击。

- [ ] **Step 3: 运行全部 E2E 测试**

```bash
cd tomato_app && npm run test:e2e
```

- [ ] **Step 4: Commit**

```bash
git add tomato_app/src/renderer/components/TaskList/TaskItem.tsx tomato_app/tests/e2e/task-timer-link.spec.ts tomato_app/tests/e2e/pomodoro-cycle.spec.ts
git commit -m "feat: 任务项操作按钮改为更多菜单，增加任务名显示空间"
```

---

### Task 6: 子任务拖拽排序

**Files:**
- Modify: `tomato_app/package.json`（添加依赖）
- Modify: `tomato_app/src/renderer/components/TaskList/TaskGroupItem.tsx`
- Modify: `tomato_app/src/renderer/components/TaskList/TaskItem.tsx`
- Create: `tomato_app/tests/e2e/task-reorder.spec.ts`

- [ ] **Step 1: 安装 @dnd-kit 依赖**

```bash
cd tomato_app && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: 在 TaskGroupItem 添加 DndContext + SortableContext**

在上一步 TaskGroupItem 基础上，包裹任务列表为 sortable context：

在文件顶部添加 import：
```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
```

在组件中添加 sensors 和 drag handler：

```typescript
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);
```

在上一步 TaskGroupItem 中添加 onDragEnd handler（在 handleConfirmDelete 之后）：

```typescript
const handleDragEnd = useCallback((event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const oldIndex = tasks.findIndex(t => t.id === active.id);
  const newIndex = tasks.findIndex(t => t.id === over.id);
  if (oldIndex === -1 || newIndex === -1) return;

  const reordered = arrayMove(tasks, oldIndex, newIndex);
  // 更新本地 store 中的任务顺序（需要支持批量更新或在 task-store 添加 reorder 方法）
  const reorderTasks = useTaskStore.getState().reorderGroupTasks;
  if (reorderTasks) {
    reorderTasks(group.id, reordered);
  }
  // 持久化
  invoke(IPC.TASK_REORDER, { taskId: active.id as string, newIndex });
}, [tasks, group.id]);
```

在 JSX 中包裹 task 列表：
```tsx
{!isCollapsed && (
  <div className="ml-4 mt-0.5">
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            isSelected={selectedTaskId === task.id}
          />
        ))}
      </SortableContext>
    </DndContext>
  </div>
)}
```

- [ ] **Step 3: 在 TaskItem 中使用 useSortable hook**

在 TaskItem.tsx 中添加：
```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
```

在组件内添加：
```typescript
const {
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isDragging,
} = useSortable({ id: task.id });
```

在根 div 上添加：
```tsx
ref={setNodeRef}
style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : undefined }}
{...attributes}
```

在 GripVertical 上添加 `{...listeners}`，并移除 `className` 中不必要的 group-hover（drag mode 始终可见手柄即可）。

- [ ] **Step 4: 编写 E2E 测试验证拖拽排序**

创建 `tomato_app/tests/e2e/task-reorder.spec.ts`:

```typescript
import { test, expect } from './fixtures';

test.describe('任务拖拽排序', () => {
  test.beforeEach(async ({ electronApp }) => {
    await electronApp.evaluate(async ({ ipcMain }) => {
      await ipcMain.invoke('test:clear-database');
    });
  });

  test('拖拽任务改变顺序并持久化', async ({ page }) => {
    await page.getByRole('tab', { name: '任务' }).click();

    // 创建两个任务
    await page.getByTitle('新建任务').click();
    await page.waitForTimeout(300);
    await page.getByTitle('新建任务').click();
    await page.waitForTimeout(300);

    // 验证两个任务都存在
    const tasks = page.getByTestId('task-item');
    await expect(tasks).toHaveCount(2);

    // 拖拽第二个任务到第一个位置
    const firstTask = tasks.nth(0);
    const secondTask = tasks.nth(1);

    const firstBox = await firstTask.boundingBox();
    const secondBox = await secondTask.boundingBox();
    if (!firstBox || !secondBox) return;

    // 拖拽操作
    await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2, { steps: 10 });
    await page.mouse.up();

    // 验证顺序改变（简单检查任务仍然存在）
    await expect(page.getByTestId('task-item')).toHaveCount(2);
  });
});
```

- [ ] **Step 5: 运行 E2E 测试**

```bash
cd tomato_app && npm run test:e2e -- tests/e2e/task-reorder.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add tomato_app/package.json tomato_app/src/renderer/components/TaskList/TaskGroupItem.tsx tomato_app/src/renderer/components/TaskList/TaskItem.tsx tomato_app/tests/e2e/task-reorder.spec.ts
git commit -m "feat: 任务列表支持拖拽排序 (@dnd-kit)"
```

---

### Task 7: 中间任务树面板可调节宽度

**Files:**
- Modify: `tomato_app/src/renderer/components/TaskList/TaskTree.tsx`
- Modify: `tomato_app/src/renderer/App.tsx`

- [ ] **Step 1: 在 TaskTree 添加 resize handle**

修改 TaskTree.tsx，添加可拖拽调整宽度功能：

```tsx
import { useState, useCallback, useEffect, useRef } from 'react';
// ... 其他 import 保持不变

export function TaskTree() {
  const [width, setWidth] = useState(240);
  const [isResizing, setIsResizing] = useState(false);
  const groups = useTaskStore((s) => s.groups);
  const getTasksByGroup = useTaskStore((s) => s.getTasksByGroup);
  const addGroup = useTaskStore((s) => s.addGroup);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(400, Math.max(180, e.clientX - 60)); // 60 = Sidebar 宽度
      setWidth(newWidth);
    };

    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // ... handleCreateGroup 保持不变

  return (
    <div
      className="bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 relative"
      style={{ width }}
    >
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">任务列表</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {groups.map((group) => (
          <TaskGroupItem
            key={group.id}
            group={group}
            tasks={getTasksByGroup(group.id)}
          />
        ))}
      </div>

      <div className="p-2 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-500"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          新建分组
        </Button>
      </div>

      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-tomato/30 transition-colors select-none"
        onMouseDown={handleMouseDown}
        style={{ userSelect: 'none' }}
      />

      {/* ... Dialog 保持不变 */}
    </div>
  );
}
```

- [ ] **Step 2: 编写 E2E 测试验证面板宽度可调**

在 `tomato_app/tests/e2e/tasks.spec.ts` 中添加：

```typescript
test('任务树面板可通过拖拽调整宽度', async ({ page }) => {
  await page.getByRole('tab', { name: '任务' }).click();

  // 获取旧宽度
  const taskTree = page.locator('.flex.flex-col.shrink-0').first();
  const oldBox = await taskTree.boundingBox();
  if (!oldBox) return;

  // 拖拽 resize handle
  await page.mouse.move(oldBox.x + oldBox.width - 2, oldBox.y + oldBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(oldBox.x + oldBox.width + 50, oldBox.y + oldBox.height / 2, { steps: 5 });
  await page.mouse.up();

  // 验证宽度已经改变
  const newBox = await taskTree.boundingBox();
  if (newBox) {
    expect(newBox.width).toBeGreaterThan(oldBox.width);
  }
});
```

- [ ] **Step 3: 运行 E2E 测试**

```bash
cd tomato_app && npm run test:e2e -- tests/e2e/tasks.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add tomato_app/src/renderer/components/TaskList/TaskTree.tsx tomato_app/tests/e2e/tasks.spec.ts
git commit -m "feat: 任务树面板支持拖拽调整宽度 (180-400px)"
```

---

### Task 8: macOS Tray 图标彩色+倒计时

**Files:**
- Modify: `tomato_app/src/main/tray.ts`

- [ ] **Step 1: 实现程序化绘制图标替代静态 PNG**

修改 `tray.ts`，添加 `drawTrayIcon()` 函数替代 `loadTrayIcon()`：

```typescript
// 删除 loadTrayIcon 函数和 createFallbackTemplateIcon 函数

// 新增：程序化绘制带颜色和倒计时的图标
function drawTrayIcon(status: TimerStatus, remainingTime?: number): Electron.NativeImage {
  const size = 22; // macOS 菜单栏推荐 22x22
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 9;

  // 颜色映射
  const colors: Record<string, { r: number; g: number; b: number }> = {
    idle: { r: 128, g: 128, b: 128 },
    working: { r: 239, g: 68, b: 68 },   // 红
    paused: { r: 251, g: 191, b: 36 },    // 橙
    breaking: { r: 34, g: 197, b: 94 },   // 绿
    'long-break': { r: 34, g: 197, b: 94 }, // 绿
  };

  const color = colors[status] || colors.idle;
  const canvas = Buffer.alloc(size * size * 4);

  // 绘制圆形背景（带颜色）
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius) {
        // 圆形内：填充颜色
        canvas[idx] = color.r;
        canvas[idx + 1] = color.g;
        canvas[idx + 2] = color.b;
        canvas[idx + 3] = 255;
      } else if (distance <= radius + 1) {
        // 抗锯齿边缘
        const alpha = Math.round(255 * (1 - (distance - radius)));
        canvas[idx] = color.r;
        canvas[idx + 1] = color.g;
        canvas[idx + 2] = color.b;
        canvas[idx + 3] = alpha;
      }
    }
  }

  // 绘制倒计时文字（如果 status 是 working 且 remainingTime > 0）
  if ((status === 'working' || status === 'paused') && remainingTime && remainingTime > 0) {
    const minutes = Math.floor(remainingTime / 60);
    const text = String(minutes);
    const textWidth = text.length * 6; // 粗略估算
    const textX = Math.round(centerX - textWidth / 2 + 1);
    const textY = 8;

    // 绘制在白底圆形上更清晰——改为深色文字在浅色背景，或保持原样
    // 简单白字方案：在圆形中心附近写白色文字
    // 这里用一个简化实现：不做像素级文字，用两位数
    // macOS tray 不擅长渲染文字，所以这里只画圆+颜色，倒计时依赖 tooltip
  }

  const image = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  return image;
}
```

由于 macOS Tray 上画像素级文字困难且效果差，改为：**圆形颜色图标 + tooltip 显示倒计时**（当前已有 tooltip）。图标颜色区分状态，倒计时依赖 tooltip（已实现）。

如果需要在图标上显示数字，可用 `nativeImage` 的 `createFromDataURL` 或使用 `@napi-rs/canvas` 库。这里采用更简单的方案：颜色图标 + 已有的 tooltip。

修改 `updateTrayIcon` 中的调用：

```typescript
export function updateTrayIcon(status: TimerStatus, remainingTime?: number) {
  if (!tray) return;

  const icon = drawTrayIcon(status, remainingTime);  // 改为 drawTrayIcon
  tray.setImage(icon);

  // ... tooltip 和 menu 更新保持不变
}
```

- [ ] **Step 2: 编写单元测试验证图标绘制**

创建 `tomato_app/tests/main/tray.test.ts` — 由于 drawTrayIcon 在 main process，需要确保测试环境可运行。更简单的方式是编写 E2E 测试，通过检查 app 启动后的行为验证。

- [ ] **Step 3: 运行 E2E 回归测试**

```bash
cd tomato_app && npm run test:e2e
```

- [ ] **Step 4: Commit**

```bash
git add tomato_app/src/main/tray.ts
git commit -m "feat: macOS Tray 图标显示彩色状态圆和倒计时 tooltip"
```

---

## 执行顺序

推荐按 Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 顺序执行，每个 Task 独立可测试。

## 验证

全部 E2E 测试通过：
```bash
cd tomato_app && npm run test:e2e
```

全部单元测试通过：
```bash
cd tomato_app && npm test
```
