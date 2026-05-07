# Bug 修复与 UI 优化设计文档

日期: 2026-05-07

## 问题概述

修复 6 个已确认问题，覆盖通知、统计、UI 布局、拖拽排序等领域。

---

## 1. macOS 通知修复

### 问题
番茄计时结束后 macOS 通知从未弹出。

### 根因
`notifications.ts:26-35` 调用非标准 API `session.defaultSession.getPermissionStatus('notifications')`，在 macOS 上返回 `'unknown'`，导致提前 return，通知静默跳过。

### 修复
- 移除 `getPermissionStatus` 检查和提前 return
- `setupNotificationPermissions()` 已在 `main/index.ts:14` 处正确配置权限 handler，通知 API 可直接使用

### 涉及文件
- `tomato_app/src/main/notifications.ts:26-35`

---

## 2. 任务完成统计记录

### 问题
`daily_stats` 表从未被写入，只有读取逻辑。

### 根因
`StatsRepository.upsert()` 方法存在于 `packages/core/src/db/stats-repository.ts`，但代码库中无任何调用点。

### 修复
在 `ipc-handlers.ts` 的 `setupTimerEvents()` 中，当 `'complete'` 事件 type 为 `'work'` 时，直接调用 `statsRepo.upsert()` 递增当日 `totalPomodoros`。需要将 `statsRepo` 传入 `registerIpcHandlers`。

### 涉及文件
- `tomato_app/src/main/ipc-handlers.ts:77-85`（添加 stats 写入）
- `packages/core/src/db/stats-repository.ts`（复用已有 upsert 方法）

---

## 3. 笔记编辑区域优化

### 问题
- 当前 `TaskDetail.tsx` 中笔记区域高度硬编码 300px，编辑器太小
- "📝 笔记" 标题 + 保存按钮占据额外空间

### 修复
- 移除 "📝 笔记" 标题和保存按钮
- 编辑器使用 `flex-1` + `min-h-0` 撑满父容器垂直空间，类似 OneNote 全页面体验
- 添加 autoSave 机制：利用现有 `useEffect` 监听 notes 变化，编辑停止 1 秒后自动保存（防抖）
- 保留 `IPC.TASK_EDIT` 持久化逻辑

### 涉及文件
- `tomato_app/src/renderer/components/TaskList/TaskDetail.tsx`

---

## 4. 任务组删除功能

### 问题
任务组没有删除入口。

### 根因
`TaskGroupItem.tsx` 使用简化的内联 header，缺少"更多菜单"。`TaskGroupHeader.tsx` 虽有完整菜单但未被 `TaskGroupItem` 使用。

### 修复
- 在 `TaskGroupItem.tsx` 的 header 右侧添加 `MoreHorizontal` 按钮
- 弹出下拉菜单：重命名、删除、颜色选择
- 删除非默认分组时调用 `IPC.GROUP_DELETE`
- 删除前弹出确认对话框
- 默认分组不显示删除选项

### 涉及文件
- `tomato_app/src/renderer/components/TaskList/TaskGroupItem.tsx`

---

## 5. 任务列表项优化防截断

### 问题
`TaskItem.tsx` 行内元素拥挤（checkbox + title + 🍅 + xN + 操作按钮组），任务名称太长时被截断。

### 修复
- 操作按钮组（▶ ✎ 🗑）替换为 `⋯` 更多菜单
- 更多菜单内放：开始专注 / 重命名 / 删除
- 拖拽手柄 `GripVertical` 仅 hover 时出现（drag mode 始终可见）
- 番茄计数 `xN` 和计时指示器 `🍅` 合并为紧凑样式，字体缩小
- Checkbox、🍅、xN 均使用 `shrink-0` 防止挤压

### 涉及文件
- `tomato_app/src/renderer/components/TaskList/TaskItem.tsx`

---

## 6. 子任务拖拽排序

### 问题
任务无法上下拖拽调整位置。`GripVertical` 手柄存在但无 drag 逻辑。

### 修复
- 安装 `@dnd-kit/core` + `@dnd-kit/sortable` 依赖
- 在 `TaskGroupItem.tsx` 中使用 `DndContext` + `SortableContext` 包裹任务列表
- 在 `TaskItem.tsx` 中用 `useSortable` hook 替换手动 drag
- 排序完成后调用 `IPC.TASK_REORDER` 持久化到数据库

### 涉及文件
- `tomato_app/package.json`（添加依赖）
- `tomato_app/src/renderer/components/TaskList/TaskGroupItem.tsx`
- `tomato_app/src/renderer/components/TaskList/TaskItem.tsx`

---

## 7. 中间任务树面板可调节宽度

### 问题
`TaskTree` 固定宽度 `w-60`（240px），任务名稍长就被截断。

### 修复
- 在 `TaskTree` 右边缘添加拖拽手柄（resize handle），宽度 4px
- 支持左右拖拽，范围 200px ~ 400px
- 使用 `onMouseDown` + `onMouseMove` 实现拖拽逻辑
- 状态存储在 `TaskTree` 组件本地 state

### 涉及文件
- `tomato_app/src/renderer/components/TaskList/TaskTree.tsx`

---

## 8. macOS Tray 图标彩色+倒计时

### 问题
当前图标是静态 Template PNG，无颜色、无倒计时数字。

### 修复
放弃静态 PNG，用 `nativeImage.createFromBuffer` 程序化绘制图标：
- 圆形背景色：红(working) / 绿(breaking) / 橙(paused) / 灰(idle)
- 叠加倒计时文字（剩余分钟数）
- 每秒通过 `tray.setImage()` 更新
- 深色/浅色主题分别使用对应饱和度颜色

### 涉及文件
- `tomato_app/src/main/tray.ts`

---

## 技术要点

- **无新依赖**（除 `@dnd-kit`）
- **向后兼容**：所有改动仅增强现有功能，不破坏已有流程
- **无 schema 变更**：统计记录复用已有 `daily_stats` 表结构
- **autoSave 防抖**：1 秒无操作后自动保存，减少 IO

## 自检

- 无 TBD/TODO 占位
- 无内部矛盾
- scope 适中，8 个改动点均可独立实施
- 需求无歧义
