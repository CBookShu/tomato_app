# Bug 修复设计文档

## 概述

修复三个 bug：
1. 子任务番茄完成后显示错误任务名称和数量
2. 笔记区域设计不符合预期
3. 统计页面不更新数据

---

## Bug 1: 任务 ID 同步问题

### 问题描述

当第二个子任务完成番茄后，显示了第一个任务的名字和完成数量。

### 根本原因

`IPC.TIMER_STATUS_CHANGE` 事件只发送 `status` 和 `remainingTime`，没有发送 `currentTaskId`。

**问题代码**:

`tomato_app/src/main/ipc-handlers.ts` 第 68-75 行：
```typescript
t.on('statusChange', (status: string, remainingTime: number) => {
  currentTimerStatus = status as TimerStatus;
  currentRemainingTime = remainingTime;
  safeSend(win, IPC.TIMER_STATUS_CHANGE, status, remainingTime);
  // 缺少 currentTaskId！
});
```

### 修复方案

**文件 1**: `tomato_app/src/main/ipc-handlers.ts`

修改 `setupTimerEvents` 函数，发送完整状态：

```typescript
t.on('statusChange', (status: string, remainingTime: number) => {
  currentTimerStatus = status as TimerStatus;
  currentRemainingTime = remainingTime;
  const state = t.getState();
  safeSend(win, IPC.TIMER_STATUS_CHANGE, status, remainingTime, state.currentTaskId);
  // ...
});
```

**文件 2**: `tomato_app/src/renderer/hooks/useTimer.ts`

修改 `TIMER_STATUS_CHANGE` 监听器，接收并使用 `currentTaskId`：

```typescript
const unsubStatus = listen(IPC.TIMER_STATUS_CHANGE, (status: unknown, remainingTime?: unknown, taskId?: unknown) => {
  const state: TimerState = {
    ...useTimerStore.getState(),
    status: status as TimerState['status'],
    remainingTime: (remainingTime as number) ?? useTimerStore.getState().remainingTime,
    currentTaskId: (taskId as string) ?? useTimerStore.getState().currentTaskId,
  };
  store.setState(state);
});
```

### 验收标准

1. 开始任务 A 计时
2. 切换到任务 B 并开始计时
3. 番茄完成后，任务 B 的完成数量增加，显示正确

---

## Bug 2: 笔记区域设计

### 问题描述

笔记区域应删除标题和保存状态文字，让编辑器占满空间。

### 修复方案

**文件**: `tomato_app/src/renderer/components/TaskList/TaskDetail.tsx`

删除第 151-158 行的标题行：

```diff
- <div className="flex items-center justify-between mb-2">
-   <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
-     📝 笔记
-   </h2>
-   <span className="text-xs text-gray-500">
-     {isSaving ? '保存中...' : saveError || '已自动保存'}
-   </span>
- </div>
```

保留自动保存功能（后台运行），但不显示状态。

### 验收标准

1. 笔记编辑区域占满可用空间
2. 没有标题行和保存状态显示
3. 自动保存功能正常工作

---

## Bug 3: 统计不更新

### 问题描述

任务完成后，统计页面一直显示 0。

### 根本原因

统计数据只在应用启动时加载（`App.tsx` 第 52-62 行），任务完成或番茄完成时没有刷新。

### 修复方案

**文件 1**: `tomato_app/src/renderer/hooks/useStatsRefresh.ts`（新建）

```typescript
import { useEffect } from 'react';
import { useStatsStore } from '@/stores/stats-store.js';
import { useIpc } from './useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import { getToday } from '@pomodoro/core/dist/utils/date-utils.js';

export function useStatsRefresh() {
  const { invoke, listen } = useIpc();
  const statsStore = useStatsStore();

  const refreshTodayStats = async () => {
    const today = await invoke(IPC.STATS_GET_DAILY, { date: getToday() });
    statsStore.setToday(today);
  };

  useEffect(() => {
    // 番茄完成时刷新统计
    const unsubComplete = listen(IPC.TIMER_COMPLETE, async (_type: unknown) => {
      if (_type === 'work') {
        await refreshTodayStats();
      }
    });

    // 任务完成时刷新统计
    const unsubTaskComplete = listen(IPC.TASK_COMPLETE_EVENT, async () => {
      await refreshTodayStats();
    });

    return () => {
      unsubComplete();
      unsubTaskComplete();
    };
  }, []);
}
```

**文件 2**: `tomato_app/src/renderer/App.tsx`

添加 hook 使用：

```diff
+ import { useStatsRefresh } from '@/hooks/useStatsRefresh.js';

export default function App() {
+   useStatsRefresh();
```

**文件 3**: `tomato_app/src/main/ipc-handlers.ts`

添加任务完成事件通知：

```diff
  ipcMain.handle(IPC.TASK_COMPLETE, async (_e, payload) => {
-   return taskManager!.completeTask(payload.id);
+   const result = await taskManager!.completeTask(payload.id);
+   safeSend(currentWindow, IPC.TASK_COMPLETE_EVENT, payload.id);
+   return result;
  });
```

**文件 4**: `tomato_app/src/shared/ipc-channels.ts`

添加新 IPC channel：

```diff
+ TASK_COMPLETE_EVENT: 'task:complete:event',
```

### 验收标准

1. 完成一个番茄后，统计页面的番茄数增加
2. 完成一个任务后，统计页面的完成任务数增加
3. 不需要刷新页面

---

## 实现顺序

1. Bug 2（最简单，删除代码）
2. Bug 1（中等，修改 IPC 通信）
3. Bug 3（中等，添加事件监听）

---

## 测试验证

1. 手动测试三个 bug 的修复效果
2. 运行 E2E 测试确保没有回归
