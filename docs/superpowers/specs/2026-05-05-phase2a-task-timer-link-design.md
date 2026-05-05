# Phase 2a: 任务-番茄联动 + 托盘联动设计

**日期**: 2026-05-05
**状态**: 待审核

## 概述

实现任务与番茄计时器的双向联动，以及系统托盘的状态同步显示。

## 目标

1. 用户能快速识别当前正在专注的任务
2. 从番茄页面能跳转到当前任务
3. 删除正在计时的任务时有保护机制
4. 托盘实时显示计时状态，无需打开应用

---

## 1. 通知设计

### 1.1 番茄时间结束

```
┌─────────────────────────────┐
│ 🍅  Tomato         刚刚     │
│                             │
│ 🍅 番茄时间结束              │
│ 该休息一下了！你完成了 1 个番茄钟。│
│                             │
│ [关闭]         [打开应用]   │
└─────────────────────────────┘
```

### 1.2 休息时间结束

```
┌─────────────────────────────┐
│ ☕  Tomato         刚刚     │
│                             │
│ ☕ 休息时间结束              │
│ 可以继续专注了！            │
│                             │
│ [关闭]         [打开应用]   │
└─────────────────────────────┘
```

### 1.3 交互

- **关闭**：仅关闭通知，不影响计时器
- **打开应用**：聚焦到应用窗口，用户自行决定下一步
- **自动消失**：3-5 秒后自动关闭（可配置）

---

## 2. 任务-番茄联动 UI

### 2.1 分组级别显示

当某个任务正在计时时，其所属分组右侧显示：

```
┌─────────────────────────────┐
│ ▼ 🔵 工作           2/3  🍅 18:42 │
│   ├ 📝 完成项目报告   🍅         │
│   ├ 📝 代码审查       x2        │
│   └ ☑ 整理文档                  │
├─────────────────────────────┤
│ ▶ 🟢 学习           0/2        │
└─────────────────────────────┘
```

- **🍅 + 倒计时**：显示在分组右侧
- **呼吸动画**：视觉上吸引注意力
- **折叠时可见**：即使分组折叠，也能快速定位

### 2.2 任务级别显示

正在专注的任务：

- **🍅 图标**：显示在任务右侧
- **浅红背景**：`bg-tomato/10 dark:bg-tomato/20`
- **选中状态**：点击可查看详情

### 2.3 番茄页面跳转

**计时器下方**：
```
当前任务：完成项目报告
```
点击跳转到任务详情。

**状态栏**：
```
🍅 18:42 专注中 | 当前：完成项目报告
```
点击任务名跳转。

---

## 3. 删除保护

当删除正在计时的任务时，弹出确认对话框：

```
┌─────────────────────────────────────┐
│ ⚠️ 确认删除                          │
│                                     │
│ 任务「完成项目报告」正在专注中        │
│ （剩余 18:42），删除后将停止计时。   │
│                                     │
│           [取消]    [确定删除]      │
└─────────────────────────────────────┘
```

确认删除后：
1. 停止当前计时器
2. 计时器状态重置为 idle
3. 清空 `currentTaskId`（移除任务高亮）
4. 更新托盘图标为空闲状态
5. 删除任务

---

## 4. 托盘设计

### 4.1 图标布局（垂直）

```
┌────┐
│ 🍅 │  ← 图标
│18:42│  ← 倒计时
└────┘
```

通过动态生成图标图片实现垂直布局。

### 4.2 状态显示

| 状态 | 图标 | 时间颜色 | 时间显示 |
|------|------|----------|----------|
| 空闲 | 🍅（半透明，40%） | 无 | 无 |
| 专注 | 🍅 | 红色 #EF4444 | `MM:SS` |
| 休息 | ☕ | 绿色 #22C55E | `MM:SS` |

### 4.3 交互

**双击**：打开/聚焦应用窗口

**右键菜单**：
```
┌─────────────────────┐
│      🍅 专注中       │
│      18:42          │
│  当前：完成项目报告   │
├─────────────────────┤
│ ⏸ 暂停             │
│ ⏹ 停止             │
├─────────────────────┤
│ 📂 打开应用         │
│ 🚪 退出             │
└─────────────────────┘
```

菜单项根据当前状态动态显示：
- 专注中：显示"暂停"、"停止"
- 休息中：显示"跳过休息"、"停止"
- 空闲：无操作按钮

---

## 5. 技术实现要点

### 5.1 托盘图标生成

使用 Canvas 动态绘制：

```typescript
function generateTrayIcon(status: TimerStatus, time?: string): NativeImage {
  const canvas = createCanvas(28, 44);
  const ctx = canvas.getContext('2d');
  
  // 绘制图标
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.globalAlpha = status === 'idle' ? 0.4 : 1;
  ctx.fillText(status === 'breaking' ? '☕' : '🍅', 14, 18);
  
  // 绘制时间
  if (time && status !== 'idle') {
    ctx.globalAlpha = 1;
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = status === 'working' ? '#EF4444' : '#22C55E';
    ctx.fillText(time, 14, 32);
  }
  
  return nativeImage.createFromDataURL(canvas.toDataURL());
}
```

### 5.2 任务-计时器状态同步

在 `timer-store` 中维护 `currentTaskId`：

```typescript
interface TimerStoreState {
  status: TimerStatus;
  remainingTime: number;
  currentTaskId: string | null;
  // ...
}
```

在 `task-store` 中根据 `currentTaskId` 判断高亮：

```typescript
const activeTaskId = useTimerStore((s) => s.currentTaskId);
const isTaskActive = task.id === activeTaskId;
```

### 5.3 通知修复

Timer 完成事件由 main 进程直接处理并触发系统通知：

```typescript
// main/timer.ts - Timer 实例的 complete 事件
timer.on('complete', (type: 'work' | 'break') => {
  // 直接在 main 进程触发通知
  if (type === 'work') {
    showNotification('🍅 番茄时间结束', '该休息一下了！');
  } else {
    showNotification('☕ 休息时间结束', '可以继续专注了！');
  }
  // 同时通知 renderer 更新 UI
  mainWindow?.webContents.send(IPC.TIMER_COMPLETE, type);
});
```

通知按钮交互通过 macOS 原生 API 实现：

```typescript
// main/notifications.ts
function showNotification(title: string, body: string) {
  const notification = new Notification({
    title,
    body,
    actions: [
      { type: 'button', text: '关闭' },
      { type: 'button', text: '打开应用' }
    ]
  });
  
  notification.on('action', (event, index) => {
    if (index === 1) { // 打开应用
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
  
  notification.show();
}
```

---

## 6. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/main/tray.ts` | 重构 | 动态图标生成 + 菜单交互 |
| `src/main/notifications.ts` | 修改 | 添加交互按钮，处理按钮点击 |
| `src/main/timer.ts` | 修改 | 添加 complete 事件处理，触发通知 |
| `src/main/ipc-handlers.ts` | 修改 | 添加托盘菜单操作的 IPC handlers（暂停、停止、跳过休息） |
| `src/shared/ipc-channels.ts` | 修改 | 定义托盘操作相关 IPC channels |
| `src/preload/index.ts` | 修改 | 暴露托盘操作相关 API |
| `src/renderer/stores/timer-store.ts` | 修改 | 添加 currentTaskId 管理 |
| `src/renderer/components/TaskList/TaskGroupItem.tsx` | 修改 | 显示分组计时状态 |
| `src/renderer/components/TaskList/TaskItem.tsx` | 修改 | 显示任务计时状态 |
| `src/renderer/components/Timer/TimerDisplay.tsx` | 修改 | 显示当前任务链接 |
| `src/renderer/components/Layout/StatusBar.tsx` | 修改 | 显示当前任务链接 |
| `src/renderer/components/ui/confirm-dialog.tsx` | 新增 | 删除确认对话框 |

---

## 7. 验收标准

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
