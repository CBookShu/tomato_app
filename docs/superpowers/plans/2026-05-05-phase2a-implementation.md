# Phase 2a: Task-Timer Link + Tray Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement bidirectional task-timer linkage, tray icon with countdown, timer completion notifications with action buttons, and delete protection for active tasks.

**Architecture:** Extend existing timer-store with currentTaskId management, refactor tray.ts to generate dynamic icons with emoji+time overlay, add action buttons to notifications via Electron's Notification API, and implement a confirmation dialog for delete protection.

**Tech Stack:** Electron, React, TypeScript, Zustand, Tailwind CSS, Radix UI

---

## File Structure

| File | Purpose |
|------|---------|
| `src/main/tray.ts` | Dynamic icon generation, menu with actions |
| `src/main/notifications.ts` | Notifications with action buttons |
| `src/main/ipc-handlers.ts` | Tray action IPC handlers |
| `src/main/index.ts` | Track current task title, wire up tray updates |
| `src/shared/ipc-channels.ts` | New IPC channel definitions |
| `src/preload/index.ts` | Expose tray action APIs |
| `src/renderer/stores/timer-store.ts` | currentTaskId management |
| `src/renderer/stores/task-store.ts` | Active task highlighting |
| `src/renderer/components/TaskList/TaskItem.tsx` | Timer indicator, delete confirmation |
| `src/renderer/components/TaskList/TaskGroupItem.tsx` | Group timer indicator |
| `src/renderer/components/Timer/TimerDisplay.tsx` | Current task link |
| `src/renderer/components/Layout/StatusBar.tsx` | Current task link |
| `src/renderer/components/ui/confirm-dialog.tsx` | Reusable confirmation dialog |
| `src/renderer/hooks/useTimer.ts` | Pass taskId on start, handle tray actions |

---

## Task 1: Add IPC Channels for Tray Actions

**Files:**
- Modify: `tomato_app/src/shared/ipc-channels.ts`

- [ ] **Step 1: Add tray action channels to IPC constants**

```typescript
// In src/shared/ipc-channels.ts, add after TIMER_COMPLETE (around line 15):
  TRAY_PAUSE: 'tray:pause',
  TRAY_STOP: 'tray:stop',
  TRAY_SKIP_BREAK: 'tray:skipBreak',
```

- [ ] **Step 2: Add channel type definitions to IpcChannelMap**

```typescript
// In IpcChannelMap interface, add after TIMER_COMPLETE:
  [IPC.TRAY_PAUSE]: { request: void; response: void };
  [IPC.TRAY_STOP]: { request: void; response: void };
  [IPC.TRAY_SKIP_BREAK]: { request: void; response: void };
```

- [ ] **Step 3: Commit**

```bash
git add tomato_app/src/shared/ipc-channels.ts
git commit -m "feat(ipc): add tray action channels"
```

---

## Task 2: Implement Tray Action IPC Handlers

**Files:**
- Modify: `tomato_app/src/main/ipc-handlers.ts`

- [ ] **Step 1: Add tray action handlers in registerIpcHandlers**

```typescript
// In src/main/ipc-handlers.ts, add after TIMER_STATE handler (around line 79):

  // Tray action handlers - forward to timer actions
  ipcMain.handle(IPC.TRAY_PAUSE, async () => (await getTimer()).pause());
  ipcMain.handle(IPC.TRAY_STOP, async () => (await getTimer()).stop());
  ipcMain.handle(IPC.TRAY_SKIP_BREAK, async () => (await getTimer()).skip());
```

- [ ] **Step 2: Commit**

```bash
git add tomato_app/src/main/ipc-handlers.ts
git commit -m "feat(ipc): add tray action handlers"
```

---

## Task 3: Implement Dynamic Tray Icon Generation

**Files:**
- Modify: `tomato_app/src/main/tray.ts`

- [ ] **Step 1: Add imports and update type definitions**

```typescript
// Update imports at top:
import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import { IPC } from '../shared/ipc-channels.js';

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let currentTaskTitle: string | undefined = undefined;

type TimerStatus = 'idle' | 'working' | 'paused' | 'breaking' | 'long-break';
```

- [ ] **Step 2: Replace createIcon with generateTrayIcon function**

```typescript
function generateTrayIcon(status: TimerStatus, timeStr?: string): Electron.NativeImage {
  const width = 28;
  const height = 44;
  const canvas = Buffer.alloc(width * height * 4);

  const colors: Record<string, [number, number, number]> = {
    working: [239, 68, 68],    // red #EF4444
    breaking: [34, 197, 94],   // green #22C55E
    'long-break': [34, 197, 94],
    paused: [251, 146, 60],    // orange
    idle: [156, 163, 175],     // gray
  };

  const [r, g, b] = colors[status] || colors.idle;
  const alpha = status === 'idle' ? 102 : 255; // 40% opacity for idle

  // Draw tomato shape (circle)
  const centerX = width / 2;
  const centerY = 16;
  const radius = 11;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radius * radius) {
        canvas[idx] = r;
        canvas[idx + 1] = g;
        canvas[idx + 2] = b;
        canvas[idx + 3] = alpha;
      }
    }
  }

  // Note: Time text rendering requires canvas library
  // For now, we show colored icon only, time displayed in tooltip/menu

  return nativeImage.createFromBuffer(canvas, { width, height });
}
```

- [ ] **Step 3: Update createTray function**

```typescript
export function createTray(getWindow: () => BrowserWindow | null): Tray {
  mainWindow = getWindow();
  const icon = generateTrayIcon('idle');
  tray = new Tray(icon);
  tray.setToolTip('Tomato - 就绪');

  // Double-click to open/focus window
  tray.on('double-click', () => {
    const win = mainWindow || getWindow();
    if (win) {
      win.show();
      win.focus();
    }
  });

  // Single click toggles window visibility
  tray.on('click', () => {
    const win = mainWindow || getWindow();
    if (win) {
      win.isVisible() ? win.hide() : win.show();
    }
  });

  updateTrayMenu('idle', 0);
  return tray;
}
```

- [ ] **Step 4: Implement updateTrayMenu with action buttons**

```typescript
function updateTrayMenu(status: TimerStatus, remainingTime: number) {
  if (!tray) return;

  const statusLabels: Record<string, string> = {
    idle: '就绪',
    working: '专注中',
    paused: '已暂停',
    breaking: '短休息',
    'long-break': '长休息',
  };

  const timeStr = remainingTime > 0 ? formatTime(remainingTime) : '';
  const statusLabel = statusLabels[status] || '就绪';

  const menuItems: Electron.MenuItemConstructorOptions[] = [
    { label: statusLabel, enabled: false },
  ];

  if (timeStr) {
    menuItems.push({ label: timeStr, enabled: false });
  }

  if (currentTaskTitle) {
    const truncated = currentTaskTitle.length > 15
      ? currentTaskTitle.slice(0, 15) + '...'
      : currentTaskTitle;
    menuItems.push({ label: `当前: ${truncated}`, enabled: false });
  }

  menuItems.push({ type: 'separator' });

  // Add action buttons based on status
  if (status === 'working') {
    menuItems.push({
      label: '⏸ 暂停',
      click: () => mainWindow?.webContents.send(IPC.TRAY_PAUSE),
    });
    menuItems.push({
      label: '⏹ 停止',
      click: () => mainWindow?.webContents.send(IPC.TRAY_STOP),
    });
  } else if (status === 'breaking' || status === 'long-break') {
    menuItems.push({
      label: '⏭ 跳过休息',
      click: () => mainWindow?.webContents.send(IPC.TRAY_SKIP_BREAK),
    });
    menuItems.push({
      label: '⏹ 停止',
      click: () => mainWindow?.webContents.send(IPC.TRAY_STOP),
    });
  }

  menuItems.push({ type: 'separator' });

  menuItems.push({
    label: '📂 打开应用',
    click: () => {
      mainWindow?.show();
      mainWindow?.focus();
    },
  });

  menuItems.push({
    label: '🚪 退出',
    click: () => app.quit(),
  });

  tray.setContextMenu(Menu.buildFromTemplate(menuItems));
}
```

- [ ] **Step 5: Update updateTrayIcon and updateTrayTime functions**

```typescript
export function updateTrayIcon(status: TimerStatus, remainingTime?: number) {
  if (!tray) return;

  const timeStr = remainingTime && remainingTime > 0 ? formatTime(remainingTime) : undefined;
  const icon = generateTrayIcon(status, timeStr);
  tray.setImage(icon);

  const statusLabels: Record<string, string> = {
    idle: '就绪',
    working: '专注中',
    paused: '已暂停',
    breaking: '短休息',
    'long-break': '长休息',
  };

  const timeDisplay = timeStr ? ` ${timeStr}` : '';
  tray.setToolTip(`Tomato - ${statusLabels[status] || '就绪'}${timeDisplay}`);

  updateTrayMenu(status, remainingTime ?? 0);
}

export function updateTrayTime(status: TimerStatus, remainingTime: number) {
  if (!tray) return;
  updateTrayIcon(status, remainingTime);
}

export function setTrayTaskTitle(title: string | undefined) {
  currentTaskTitle = title;
}
```

- [ ] **Step 6: Commit**

```bash
git add tomato_app/src/main/tray.ts
git commit -m "feat(tray): implement dynamic icon with action menu"
```

---

## Task 4: Add Notification Action Buttons

**Files:**
- Modify: `tomato_app/src/main/notifications.ts`

- [ ] **Step 1: Update notifications.ts with action buttons**

```typescript
import { Notification, BrowserWindow } from 'electron';

let mainWindow: BrowserWindow | null = null;

export function setNotificationWindow(win: BrowserWindow | null) {
  mainWindow = win;
}

interface NotificationAction {
  text: string;
  action: () => void;
}

export function sendNotification(
  title: string,
  body: string,
  actions?: NotificationAction[]
) {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title,
    body,
    silent: false,
    actions: actions?.map((a) => ({
      type: 'button' as const,
      text: a.text,
    })),
  });

  notification.on('action', (_event, index) => {
    actions?.[index]?.action();
  });

  notification.on('click', () => notification.close());

  notification.show();
}

export function notifyPomodoroComplete() {
  sendNotification('🍅 番茄时间结束', '该休息一下了！你完成了 1 个番茄钟。', [
    { text: '关闭', action: () => {} },
    {
      text: '打开应用',
      action: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
  ]);
}

export function notifyBreakComplete() {
  sendNotification('☕ 休息时间结束', '可以继续专注了！', [
    { text: '关闭', action: () => {} },
    {
      text: '打开应用',
      action: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
  ]);
}
```

- [ ] **Step 2: Commit**

```bash
git add tomato_app/src/main/notifications.ts
git commit -m "feat(notifications): add action buttons to timer notifications"
```

---

## Task 5: Wire Up Main Process for Tray and Notifications

**Files:**
- Modify: `tomato_app/src/main/index.ts`

- [ ] **Step 1: Update imports**

```typescript
// Update line 6:
import { notifyPomodoroComplete, notifyBreakComplete, setNotificationWindow } from './notifications.js';
import { createTray, updateTrayIcon, updateTrayTime, setTrayTaskTitle } from './tray.js';
```

- [ ] **Step 2: Initialize notification window and update tray handlers**

```typescript
// After createWindow (around line 19):
  setNotificationWindow(mainWindow);

// Update TIMER_STATUS_CHANGE handler:
ipcMain.on(IPC.TIMER_STATUS_CHANGE, (_event, status: string) => {
  if (status === 'idle') {
    setTrayTaskTitle(undefined);
  }
  updateTrayIcon(status);
});

// Update TIMER_TICK handler:
ipcMain.on(IPC.TIMER_TICK, (_event, remainingTime: number) => {
  updateTrayTime('working', remainingTime);
});
```

- [ ] **Step 3: Add handler for task title updates**

```typescript
// Add new IPC listener:
ipcMain.on('timer:taskTitle', (_event, title: string | null) => {
  setTrayTaskTitle(title ?? undefined);
});
```

- [ ] **Step 4: Commit**

```bash
git add tomato_app/src/main/index.ts
git commit -m "feat(main): wire up tray task title and notification window"
```

---

## Task 6: Update Timer Store for currentTaskId Management

**Files:**
- Modify: `tomato_app/src/renderer/stores/timer-store.ts`

- [ ] **Step 1: Add setCurrentTaskId action**

```typescript
// In TimerStoreState interface, add:
  setCurrentTaskId: (taskId: string | null) => void;

// In store implementation, add:
  setCurrentTaskId: (taskId) => set({ currentTaskId: taskId ?? undefined }),
```

- [ ] **Step 2: Commit**

```bash
git add tomato_app/src/renderer/stores/timer-store.ts
git commit -m "feat(timer-store): add setCurrentTaskId action"
```

---

## Task 7: Update useTimer Hook to Sync Task Title

**Files:**
- Modify: `tomato_app/src/renderer/hooks/useTimer.ts`

- [ ] **Step 1: Send task title to main when timer starts**

```typescript
// In start function, after invoke:
const start = useCallback(async (taskId?: string) => {
  const duration = getPomodoroDuration();
  store.setState({
    status: 'working',
    remainingTime: duration,
    currentCycle: store.currentCycle + 1,
    currentTaskId: taskId,
  });
  await invoke(IPC.TIMER_START, taskId ? { taskId } : {});

  // Send task title to main for tray display
  if (taskId) {
    const taskStore = useTaskStore.getState();
    const task = taskStore.tasks.find(t => t.id === taskId);
    if (task) {
      window.electronAPI.invoke('timer:taskTitle', task.title);
    }
  } else {
    window.electronAPI.invoke('timer:taskTitle', null);
  }
}, [store, getPomodoroDuration]);
```

- [ ] **Step 2: Clear task title when stopping**

```typescript
// In stop function, add:
const stop = useCallback(async () => {
  store.setState({ status: 'idle', remainingTime: 0, currentCycle: store.currentCycle, currentTaskId: undefined });
  await invoke(IPC.TIMER_STOP);
  window.electronAPI.invoke('timer:taskTitle', null);
}, [store]);
```

- [ ] **Step 3: Add tray action listeners**

```typescript
// In useEffect, add listeners for tray actions:
useEffect(() => {
  // ... existing listeners ...

  // Tray action listeners
  const handleTrayPause = () => pause();
  const handleTrayStop = () => stop();
  const handleTraySkip = () => skip();

  // Note: These need to be added to IPC channels first
  // For now, they're handled via IPC events from main

  return () => {
    unsubTick();
    unsubStatus();
    unsubComplete();
  };
}, []);
```

- [ ] **Step 4: Commit**

```bash
git add tomato_app/src/renderer/hooks/useTimer.ts
git commit -m "feat(useTimer): sync task title to main for tray display"
```

---

## Task 8: Add Timer Indicator to TaskItem

**Files:**
- Modify: `tomato_app/src/renderer/components/TaskList/TaskItem.tsx`

- [ ] **Step 1: Import timer store and add active task highlight**

```typescript
// Add import:
import { useTimerStore } from '@/stores/timer-store.js';

// In TaskItem component, add:
const currentTaskId = useTimerStore((s) => s.currentTaskId);
const isActive = task.id === currentTaskId;
```

- [ ] **Step 2: Update task item rendering with timer indicator**

```typescript
// Update the className in the wrapper div:
className={cn(
  'group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer',
  isCompleted && 'opacity-50',
  isSelected && 'bg-tomato/10 dark:bg-tomato/20',
  isActive && 'bg-tomato/10 dark:bg-tomato/20',
)}

// Add timer indicator after pomodoro count:
{isActive && (
  <span className="text-sm animate-pulse">🍅</span>
)}
```

- [ ] **Step 3: Add delete confirmation for active task**

```typescript
// Add imports:
import { ConfirmDialog } from '@/components/ui/confirm-dialog.js';
import { useState } from 'react';

// Add state:
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

// Update handleDelete:
const handleDelete = () => {
  if (isActive) {
    setShowDeleteConfirm(true);
  } else {
    removeTask(task.id);
  }
};

const handleConfirmDelete = async () => {
  // Stop timer first
  await window.electronAPI.invoke(IPC.TIMER_STOP);
  removeTask(task.id);
};

// Add dialog before closing div:
<ConfirmDialog
  open={showDeleteConfirm}
  onOpenChange={setShowDeleteConfirm}
  title="确认删除"
  description={`任务「${task.title}」正在专注中，删除后将停止计时。`}
  confirmLabel="确定删除"
  variant="destructive"
  onConfirm={handleConfirmDelete}
/>
```

- [ ] **Step 4: Commit**

```bash
git add tomato_app/src/renderer/components/TaskList/TaskItem.tsx
git commit -m "feat(TaskItem): add timer indicator and delete confirmation"
```

---

## Task 9: Add Timer Indicator to TaskGroupItem

**Files:**
- Modify: `tomato_app/src/renderer/components/TaskList/TaskGroupItem.tsx`

- [ ] **Step 1: Import timer store and add group indicator**

```typescript
// Add imports:
import { useTimerStore } from '@/stores/timer-store.js';

// In TaskGroupItem component, add:
const currentTaskId = useTimerStore((s) => s.currentTaskId);
const remainingTime = useTimerStore((s) => s.remainingTime);
const timerStatus = useTimerStore((s) => s.status);

// Find if any task in this group is active:
const activeTask = tasks.find(t => t.id === currentTaskId);
const showTimer = activeTask && timerStatus === 'working';

// Format remaining time:
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};
```

- [ ] **Step 2: Add timer indicator to group header**

```typescript
// After the task count span, add:
{showTimer && (
  <span className="flex items-center gap-1 text-xs text-tomato animate-pulse ml-2">
    <span>🍅</span>
    <span className="font-mono">{formatTime(remainingTime)}</span>
  </span>
)}
```

- [ ] **Step 3: Commit**

```bash
git add tomato_app/src/renderer/components/TaskList/TaskGroupItem.tsx
git commit -m "feat(TaskGroupItem): add timer indicator when task in group is active"
```

---

## Task 10: Add Current Task Link to TimerDisplay

**Files:**
- Modify: `tomato_app/src/renderer/components/Timer/TimerDisplay.tsx`

- [ ] **Step 1: Import stores and add current task link**

```typescript
// Add imports:
import { useTimerStore } from '@/stores/timer-store.js';
import { useTaskStore } from '@/stores/task-store.js';

// In TimerDisplay component:
const currentTaskId = useTimerStore((s) => s.currentTaskId);
const selectTask = useTaskStore((s) => s.selectTask);
const tasks = useTaskStore((s) => s.tasks);
const currentTask = tasks.find(t => t.id === currentTaskId);

// Add click handler:
const handleTaskClick = () => {
  if (currentTask) {
    selectTask(currentTask.id);
  }
};
```

- [ ] **Step 2: Add current task link below timer**

```typescript
// After the cycle dots div, add:
{currentTask && (
  <button
    onClick={handleTaskClick}
    className="text-sm text-gray-500 hover:text-tomato transition-colors cursor-pointer"
  >
    当前任务：{currentTask.title}
  </button>
)}
```

- [ ] **Step 3: Commit**

```bash
git add tomato_app/src/renderer/components/Timer/TimerDisplay.tsx
git commit -m "feat(TimerDisplay): add current task link"
```

---

## Task 11: Add Current Task Link to StatusBar

**Files:**
- Modify: `tomato_app/src/renderer/components/Layout/StatusBar.tsx`

- [ ] **Step 1: Import stores and add current task link**

```typescript
// Add imports:
import { useTaskStore } from '@/stores/task-store.js';

// In StatusBar component:
const currentTaskId = useTimerStore((s) => s.currentTaskId);
const selectTask = useTaskStore((s) => s.selectTask);
const tasks = useTaskStore((s) => s.tasks);
const currentTask = tasks.find(t => t.id === currentTaskId);

const handleTaskClick = () => {
  if (currentTask) {
    selectTask(currentTask.id);
  }
};
```

- [ ] **Step 2: Add task name to status display**

```typescript
// Update the status display div to include task name:
<div
  className="flex items-center gap-2 bg-white dark:bg-gray-700 px-3 py-1 rounded-full"
  role="status"
  aria-label={`计时器状态: ${config.label}`}
>
  <span className={`w-2 h-2 rounded-full ${config.color}`} />
  {showTime && (
    <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
      {formattedTime}
    </span>
  )}
  <span className="text-gray-500 dark:text-gray-400">{config.label}</span>
  {currentTask && (
    <>
      <span className="text-gray-300 dark:text-gray-600">|</span>
      <button
        onClick={handleTaskClick}
        className="text-gray-500 dark:text-gray-400 hover:text-tomato transition-colors"
      >
        当前：{currentTask.title.length > 10 ? currentTask.title.slice(0, 10) + '...' : currentTask.title}
      </button>
    </>
  )}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add tomato_app/src/renderer/components/Layout/StatusBar.tsx
git commit -m "feat(StatusBar): add current task link"
```

---

## Task 12: Integration Testing

**Files:**
- Test: Manual testing checklist

- [ ] **Step 1: Test notification flow**
  - Start a pomodoro with a task
  - Wait for completion (or mock it)
  - Verify notification appears with action buttons
  - Test "打开应用" button focuses window
  - Test "关闭" button dismisses notification

- [ ] **Step 2: Test tray icon and menu**
  - Verify icon color changes with timer status
  - Verify double-click opens window
  - Verify right-click menu shows correct actions
  - Test pause/stop from tray menu
  - Verify current task title appears in menu

- [ ] **Step 3: Test task-timer link UI**
  - Verify active task shows 🍅 indicator
  - Verify group shows timer when task is active
  - Verify clicking task link in timer/status bar selects the task
  - Verify delete confirmation appears for active task
  - Verify timer stops when confirming delete

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: verify phase 2a integration"
```

---

## Acceptance Criteria

- [ ] 番茄/休息结束时显示系统通知
- [ ] 通知有"关闭"和"打开应用"按钮
- [ ] 正在计时的任务在任务列表中高亮显示
- [ ] 分组折叠时仍能看到计时位置
- [ ] 计时器下方显示当前任务，点击可跳转
- [ ] 状态栏显示当前任务，点击可跳转
- [ ] 删除正在计时的任务时弹出确认对话框
- [ ] 确认删除后停止计时
- [ ] 托盘图标显示倒计时（专注红色，休息绿色）
- [ ] 空闲时托盘图标半透明，无时间
- [ ] 双击托盘图标打开应用
- [ ] 右键托盘图标显示操作菜单
