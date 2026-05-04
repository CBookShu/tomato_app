# Tomato App UI 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Tomato 番茄钟应用从单列 Tab 布局重构为三列布局，并增加底部状态栏。

**Architecture:** 采用组件化布局，将 AppShell 重构为 Sidebar + MainContent + StatusBar 三部分。任务页面使用任务树 + 详情面板的双列结构，其他页面居中显示。

**Tech Stack:** React, TypeScript, Tailwind CSS, Zustand, Electron

---

## 文件结构

```
tomato_app/src/renderer/
├── components/
│   ├── Layout/
│   │   ├── AppShell.tsx      # 重构: 三列布局容器
│   │   ├── Sidebar.tsx       # 新增: 左侧 Tab 导航
│   │   └── StatusBar.tsx     # 新增: 底部状态栏
│   └── TaskList/
│       ├── TaskTree.tsx      # 新增: 任务树容器
│       ├── TaskGroupItem.tsx # 新增: 可折叠分组
│       ├── TaskItem.tsx      # 修改: 适配选中状态
│       └── TaskDetail.tsx    # 新增: 任务详情面板
├── stores/
│   └── task-store.ts         # 修改: 添加选中状态
├── App.tsx                   # 修改: 调整布局结构
└── index.css                 # 修改: 添加布局样式

tomato_app/src/main/
└── window.ts                 # 修改: 窗口尺寸
```

---

### Task 1: 更新窗口尺寸

**Files:**
- Modify: `tomato_app/src/main/window.ts:15-18`

- [ ] **Step 1: 修改窗口默认宽度和最小宽度**

```typescript
export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 800,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // ... rest unchanged
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: Build succeeds without errors

- [ ] **Step 3: 提交**

```bash
git add tomato_app/src/main/window.ts
git commit -m "feat: increase window width for three-column layout"
```

---

### Task 2: 扩展 TaskStore 添加选中状态

**Files:**
- Modify: `tomato_app/src/renderer/stores/task-store.ts`

- [ ] **Step 1: 添加选中任务和折叠分组状态**

```typescript
import { create } from 'zustand';
import type { Task, TaskGroup, TaskStatus } from '@pomodoro/core';

interface TaskStoreState {
  tasks: Task[];
  groups: TaskGroup[];
  loading: boolean;
  selectedTaskId: string | null;
  collapsedGroups: Set<string>;

  setTasks: (tasks: Task[]) => void;
  setGroups: (groups: TaskGroup[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  addGroup: (group: TaskGroup) => void;
  updateGroup: (id: string, updates: Partial<TaskGroup>) => void;
  removeGroup: (id: string) => void;
  getTasksByGroup: (groupId: string) => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
  setLoading: (loading: boolean) => void;
  selectTask: (id: string | null) => void;
  toggleGroupCollapse: (groupId: string) => void;
  getSelectedTask: () => Task | null;
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks: [],
  groups: [],
  loading: false,
  selectedTaskId: null,
  collapsedGroups: new Set<string>(),

  setTasks: (tasks) => set({ tasks }),
  setGroups: (groups) => set({ groups }),

  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  addGroup: (group) => set((s) => ({ groups: [...s.groups, group] })),
  updateGroup: (id, updates) =>
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    })),
  removeGroup: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),

  getTasksByGroup: (groupId) => get().tasks.filter((t) => t.groupId === groupId),
  getTasksByStatus: (status) => get().tasks.filter((t) => t.status === status),

  setLoading: (loading) => set({ loading }),

  selectTask: (id) => set({ selectedTaskId: id }),

  toggleGroupCollapse: (groupId) =>
    set((s) => {
      const next = new Set(s.collapsedGroups);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return { collapsedGroups: next };
    }),

  getSelectedTask: () => get().tasks.find((t) => t.id === get().selectedTaskId) ?? null,
}));
```

- [ ] **Step 2: 类型检查**

Run: `cd tomato_app && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: 提交**

```bash
git add tomato_app/src/renderer/stores/task-store.ts
git commit -m "feat: add selectedTaskId and collapsedGroups to TaskStore"
```

---

### Task 3: 创建 Sidebar 组件

**Files:**
- Create: `tomato_app/src/renderer/components/Layout/Sidebar.tsx`

- [ ] **Step 1: 创建 Sidebar 组件**

```typescript
import React from 'react';
import { Timer, ListTodo, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils.js';

export type TabId = 'timer' | 'tasks' | 'stats' | 'settings';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: 'timer', icon: <Timer className="h-5 w-5" />, label: '计时' },
  { id: 'tasks', icon: <ListTodo className="h-5 w-5" />, label: '任务' },
  { id: 'stats', icon: <BarChart3 className="h-5 w-5" />, label: '统计' },
  { id: 'settings', icon: <Settings className="h-5 w-5" />, label: '设置' },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <div className="w-[60px] bg-gray-50 dark:bg-gray-900 flex flex-col items-center py-4 gap-2 border-r border-gray-200 dark:border-gray-700">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
            activeTab === tab.id
              ? 'bg-tomato text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          )}
          title={tab.label}
        >
          {tab.icon}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `cd tomato_app && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: 提交**

```bash
git add tomato_app/src/renderer/components/Layout/Sidebar.tsx
git commit -m "feat: add Sidebar component for tab navigation"
```

---

### Task 4: 创建 StatusBar 组件

**Files:**
- Create: `tomato_app/src/renderer/components/Layout/StatusBar.tsx`

- [ ] **Step 1: 创建 StatusBar 组件**

```typescript
import { useTimerStore } from '@/stores/timer-store.js';
import { useStatsStore } from '@/stores/stats-store.js';

export function StatusBar() {
  const status = useTimerStore((s) => s.status);
  const remainingTime = useTimerStore((s) => s.remainingTime);
  const formattedTime = useTimerStore((s) => s.formattedTime());
  const todayStats = useStatsStore((s) => s.today);

  const statusConfig: Record<string, { color: string; label: string }> = {
    idle: { color: 'bg-gray-400', label: '就绪' },
    working: { color: 'bg-red-500', label: '专注中' },
    paused: { color: 'bg-orange-400', label: '已暂停' },
    breaking: { color: 'bg-green-500', label: '休息中' },
    'long-break': { color: 'bg-green-500', label: '长休息' },
  };

  const config = statusConfig[status] || statusConfig.idle;
  const showTime = status !== 'idle' && remainingTime > 0;

  return (
    <div className="h-8 px-4 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs">
      <span className="text-gray-500 dark:text-gray-400">Tomato v0.1.0</span>

      <div className="flex items-center gap-4">
        <span className="text-gray-500 dark:text-gray-400">
          📊 今日 {todayStats?.totalPomodoros ?? 0} 个番茄
        </span>

        <div className="flex items-center gap-2 bg-white dark:bg-gray-700 px-3 py-1 rounded-full">
          <span className={`w-2 h-2 rounded-full ${config.color}`} />
          {showTime && (
            <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
              {formattedTime}
            </span>
          )}
          <span className="text-gray-500 dark:text-gray-400">{config.label}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `cd tomato_app && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: 提交**

```bash
git add tomato_app/src/renderer/components/Layout/StatusBar.tsx
git commit -m "feat: add StatusBar component with timer display"
```

---

### Task 5: 创建 TaskGroupItem 组件

**Files:**
- Create: `tomato_app/src/renderer/components/TaskList/TaskGroupItem.tsx`

- [ ] **Step 1: 创建 TaskGroupItem 组件**

```typescript
import type { TaskGroup, Task } from '@pomodoro/core';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TaskItem } from './TaskItem.js';
import { useTaskStore } from '@/stores/task-store.js';
import { cn } from '@/lib/utils.js';

interface TaskGroupItemProps {
  group: TaskGroup;
  tasks: Task[];
}

export function TaskGroupItem({ group, tasks }: TaskGroupItemProps) {
  const collapsedGroups = useTaskStore((s) => s.collapsedGroups);
  const toggleGroupCollapse = useTaskStore((s) => s.toggleGroupCollapse);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);

  const isCollapsed = collapsedGroups.has(group.id);
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="mb-1">
      <button
        onClick={() => toggleGroupCollapse(group.id)}
        className="w-full flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
        {group.color && (
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: group.color }}
          />
        )}
        <span className="flex-1 text-sm font-medium text-left truncate">
          {group.name}
        </span>
        <span className="text-xs text-gray-400">
          {completedCount}/{tasks.length}
        </span>
      </button>

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
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `cd tomato_app && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: 提交**

```bash
git add tomato_app/src/renderer/components/TaskList/TaskGroupItem.tsx
git commit -m "feat: add TaskGroupItem with collapse functionality"
```

---

### Task 6: 修改 TaskItem 组件支持选中状态

**Files:**
- Modify: `tomato_app/src/renderer/components/TaskList/TaskItem.tsx`

- [ ] **Step 1: 更新 TaskItem 组件**

```typescript
import { Checkbox } from '@/components/ui/checkbox.js';
import { cn } from '@/lib/utils.js';
import type { Task } from '@pomodoro/core';
import { Play } from 'lucide-react';
import { useTaskStore } from '@/stores/task-store.js';
import { useTimer } from '@/hooks/useTimer.js';

interface TaskItemProps {
  task: Task;
  isSelected: boolean;
}

export function TaskItem({ task, isSelected }: TaskItemProps) {
  const selectTask = useTaskStore((s) => s.selectTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const removeTask = useTaskStore((s) => s.removeTask);
  const { start } = useTimer();

  const isCompleted = task.status === 'completed';

  const handleClick = () => {
    selectTask(task.id);
  };

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    start(task.id);
  };

  const handleCheck = () => {
    updateTask(task.id, {
      status: isCompleted ? 'todo' : 'completed',
      completedAt: isCompleted ? undefined : new Date().toISOString(),
    });
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors',
        isSelected
          ? 'bg-red-50 dark:bg-red-900/20 border-l-2 border-tomato'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
        isCompleted && 'opacity-50'
      )}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={handleCheck}
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
      />
      <span
        className={cn(
          'flex-1 text-sm truncate',
          isCompleted && 'line-through'
        )}
      >
        {task.title}
      </span>
      <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
        {task.completedPomodoros > 0 ? `x${task.completedPomodoros}` : ''}
      </span>
      <button
        onClick={handleStart}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-opacity"
      >
        <Play className="h-3 w-3 text-tomato" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `cd tomato_app && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: 提交**

```bash
git add tomato_app/src/renderer/components/TaskList/TaskItem.tsx
git commit -m "feat: update TaskItem with selection state and start button"
```

---

### Task 7: 创建 TaskTree 组件

**Files:**
- Create: `tomato_app/src/renderer/components/TaskList/TaskTree.tsx`

- [ ] **Step 1: 创建 TaskTree 组件**

```typescript
import { useTaskStore } from '@/stores/task-store.js';
import { TaskGroupItem } from './TaskGroupItem.js';
import { Button } from '@/components/ui/button.js';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';

export function TaskTree() {
  const groups = useTaskStore((s) => s.groups);
  const getTasksByGroup = useTaskStore((s) => s.getTasksByGroup);
  const addGroup = useTaskStore((s) => s.addGroup);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    if (name) {
      addGroup({
        id: crypto.randomUUID(),
        name,
        taskOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setNewGroupName('');
      setDialogOpen(false);
    }
  };

  return (
    <div className="w-60 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建分组</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="输入分组名称"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateGroup}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `cd tomato_app && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: 提交**

```bash
git add tomato_app/src/renderer/components/TaskList/TaskTree.tsx
git commit -m "feat: add TaskTree component with group list"
```

---

### Task 8: 创建 TaskDetail 组件

**Files:**
- Create: `tomato_app/src/renderer/components/TaskList/TaskDetail.tsx`

- [ ] **Step 1: 创建 TaskDetail 组件**

```typescript
import { useTaskStore } from '@/stores/task-store.js';
import { useTimer } from '@/hooks/useTimer.js';
import { Button } from '@/components/ui/button.js';
import { Play, CheckCircle } from 'lucide-react';

export function TaskDetail() {
  const getSelectedTask = useTaskStore((s) => s.getSelectedTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const { start, status } = useTimer();

  const task = getSelectedTask();

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

  const handleStart = () => {
    start(task.id);
  };

  const handleComplete = () => {
    updateTask(task.id, {
      status: task.status === 'completed' ? 'todo' : 'completed',
      completedAt: task.status !== 'completed' ? new Date().toISOString() : undefined,
    });
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-2xl">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {task.title}
          </h1>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleStart}
              disabled={status === 'working'}
            >
              <Play className="h-4 w-4 mr-1" />
              开始专注
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleComplete}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {task.status === 'completed' ? '恢复' : '完成'}
            </Button>
          </div>
        </div>

        <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <span>🍅 已完成 {task.completedPomodoros} 个番茄</span>
          <span>📅 创建于 {new Date(task.createdAt).toLocaleDateString()}</span>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            📝 笔记
          </h2>
          <p className="text-sm text-gray-400 italic">
            笔记功能将在 Phase 2 实现...
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `cd tomato_app && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: 提交**

```bash
git add tomato_app/src/renderer/components/TaskList/TaskDetail.tsx
git commit -m "feat: add TaskDetail component for selected task"
```

---

### Task 9: 重构 AppShell 组件

**Files:**
- Modify: `tomato_app/src/renderer/components/Layout/AppShell.tsx`

- [ ] **Step 1: 重构 AppShell 为三列布局**

```typescript
import React from 'react';
import { Sidebar, TabId } from './Sidebar.js';
import { StatusBar } from './StatusBar.js';

interface AppShellProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: React.ReactNode;
  showTaskTree?: boolean;
  taskDetail?: React.ReactNode;
}

export function AppShell({
  activeTab,
  onTabChange,
  children,
  showTaskTree = false,
  taskDetail,
}: AppShellProps) {
  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-900">
      {/* 标题栏拖拽区域 */}
      <header className="h-10 drag bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700" />

      {/* 主体区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧导航 */}
        <Sidebar activeTab={activeTab} onTabChange={onTabChange} />

        {/* 内容区域 */}
        <div className="flex-1 flex overflow-hidden">
          {children}
        </div>
      </div>

      {/* 底部状态栏 */}
      <StatusBar />
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `cd tomato_app && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: 提交**

```bash
git add tomato_app/src/renderer/components/Layout/AppShell.tsx
git commit -m "refactor: restructure AppShell for three-column layout"
```

---

### Task 10: 更新 App.tsx 集成新布局

**Files:**
- Modify: `tomato_app/src/renderer/App.tsx`

- [ ] **Step 1: 更新 App.tsx**

```typescript
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/Layout/AppShell.js';
import type { TabId } from '@/components/Layout/Sidebar.js';
import { TimerDisplay } from '@/components/Timer/TimerDisplay.js';
import { TimerControls } from '@/components/Timer/TimerControls.js';
import { TaskTree } from '@/components/TaskList/TaskTree.js';
import { TaskDetail } from '@/components/TaskList/TaskDetail.js';
import { DailyStatsCard } from '@/components/Stats/DailyStatsCard.js';
import { WeeklyTrend } from '@/components/Stats/WeeklyTrend.js';
import { SettingsPage } from '@/components/Settings/SettingsPage.js';
import { useIpc } from '@/hooks/useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import { useTaskStore } from '@/stores/task-store.js';
import { useStatsStore } from '@/stores/stats-store.js';
import { getToday } from '@pomodoro/core/dist/utils/date-utils.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('timer');

  const { invoke } = useIpc();
  const taskStore = useTaskStore();
  const statsStore = useStatsStore();

  useEffect(() => {
    async function loadData() {
      taskStore.setLoading(true);
      try {
        const [tasks = [], groups = []] = await Promise.all([
          invoke(IPC.TASK_GET_ALL),
          invoke(IPC.GROUP_GET_ALL),
        ]);
        taskStore.setTasks(tasks);
        taskStore.setGroups(groups);
      } finally {
        taskStore.setLoading(false);
      }

      statsStore.setLoading(true);
      try {
        const [today, weekly = []] = await Promise.all([
          invoke(IPC.STATS_GET_DAILY, { date: getToday() }),
          invoke(IPC.STATS_GET_WEEKLY, { endDate: getToday() }),
        ]);
        statsStore.setToday(today);
        statsStore.setWeekly(weekly);
      } finally {
        statsStore.setLoading(false);
      }
    }
    loadData();
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'timer':
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            <TimerDisplay />
            <TimerControls />
          </div>
        );
      case 'tasks':
        return (
          <>
            <TaskTree />
            <TaskDetail />
          </>
        );
      case 'stats':
        return (
          <div className="flex-1 flex flex-col gap-4 max-w-md mx-auto w-full p-8">
            <DailyStatsCard />
            <WeeklyTrend />
          </div>
        );
      case 'settings':
        return (
          <div className="flex-1 flex justify-center">
            <SettingsPage />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </AppShell>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `cd tomato_app && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: 提交**

```bash
git add tomato_app/src/renderer/App.tsx
git commit -m "feat: integrate new layout with Tab-aware content"
```

---

### Task 11: 构建验证

- [ ] **Step 1: 完整构建**

Run: `npm run build`
Expected: Build succeeds without errors

- [ ] **Step 2: 打包 Electron 应用**

Run: `npx electron-builder --project ./tomato_app`
Expected: DMG and ZIP files created

- [ ] **Step 3: 手动测试清单**

1. 启动应用
2. 验证三列布局显示
3. 切换 Tab（番茄/任务/统计/设置）
4. 任务页面：展开/折叠分组
5. 任务页面：点击任务显示详情
6. 底部状态栏显示正确
7. 开始计时，状态栏更新
8. 暗色模式切换正常

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: complete Phase 1 UI redesign - three-column layout"
```

---

## 验收标准

- [ ] 三列布局正确显示
- [ ] Tab 切换正常，内容区正确显示
- [ ] 任务树支持折叠/展开
- [ ] 点击任务显示详情
- [ ] 底部状态栏始终可见
- [ ] 计时状态正确更新
- [ ] 暗色模式正常
- [ ] 窗口可拖拽、缩放正常
