# 同步系统设计文档

## 概述

基于 GitHub 仓库的多设备数据同步系统。将 SQLite 存储替换为基于文件的存储结构，利用 Git 进行版本控制和同步。

## 目标

- 单用户多设备同步
- 全量数据同步（任务、分组、统计、设置）
- 启动时自动同步 + 手动同步按钮
- 冲突时安全中止，提示用户手动解决

## 非目标

- 自动冲突合并（Git 无法自动合并的部分由用户手动处理）
- 团队协作功能
- 兼容旧数据（完全替换现有 SQLite 存储）

---

## 文件结构

```
tomato-data/
├── .meta/
│   ├── config.yaml              # 应用设置
│   └── entities/
│       ├── groups/
│       │   └── {group-id}.yaml  # 分组元数据
│       └── tasks/
│           └── {task-id}.yaml   # 任务元数据
├── tasks/
│   └── {task-id}.md             # 任务笔记（可选）
└── stats/
    └── {date}.yaml              # 每日统计
```

### 目录职责

| 目录 | 职责 | 用户可编辑 |
|------|------|-----------|
| `.meta/` | 元数据存储，程序读写 | 否 |
| `tasks/` | 用户数据，纯文本 Markdown | 是 |
| `stats/` | 统计数据，可重建 | 否 |

### 设计原则

1. **颗粒度小** - 每次修改涉及尽可能少的文件
2. **文本优先** - 所有文件为文本格式，便于 Git diff 和合并
3. **热点分散** - `order` 字段放在任务中，避免分组文件成为热点

---

## 文件内容定义

### `.meta/config.yaml`

应用全局设置。对应原 SQLite `settings` 表。

```yaml
pomodoroDuration: 25
shortBreakDuration: 5
longBreakDuration: 15
soundEnabled: true
notificationEnabled: true
```

| 字段 | 类型 | 功能说明 | 对应功能 |
|------|------|---------|---------|
| `pomodoroDuration` | number | 番茄时长（分钟） | 计时器倒计时长度 |
| `shortBreakDuration` | number | 短休息时长（分钟） | 番茄完成后休息时间 |
| `longBreakDuration` | number | 长休息时长（分钟） | 每 4 个番茄后长休息 |
| `soundEnabled` | boolean | 是否播放提示音 | 番茄完成/休息结束时 |
| `notificationEnabled` | boolean | 是否显示系统通知 | 番茄完成/休息结束时 |

---

### `.meta/entities/groups/{group-id}.yaml`

分组元数据。对应原 SQLite `task_groups` 表。`taskOrder` 存储分组内任务的排序。

```yaml
name: 工作
color: blue
taskOrder:
  - task-003
  - task-001
  - task-002
createdAt: 2026-05-10T10:00:00Z
updatedAt: 2026-05-10T12:00:00Z
```

| 字段 | 类型 | 功能说明 | 对应功能 |
|------|------|---------|---------|
| `name` | string | 分组名称 | 显示在任务列表分组标题 |
| `color` | string? | 分组颜色标识 | 分组标题颜色（可选） |
| `taskOrder` | string[] | 分组内任务 ID 列表（按顺序排列） | 任务列表排序 |
| `createdAt` | string | 创建时间（ISO 8601） | 排序、审计 |
| `updatedAt` | string | 最后修改时间（ISO 8601） | 同步冲突判断、审计 |

**文件命名：** `{group-id}.yaml`，其中 `group-id` 为 UUID。默认分组 ID 固定为 `default`。

**关联关系：**
- `taskOrder` 数组中的 ID → `.meta/entities/tasks/{task-id}.yaml`
- 任务通过 `groupId` 字段反向引用此分组

---

### `.meta/entities/tasks/{task-id}.yaml`

任务元数据。对应原 SQLite `tasks` 表。

```yaml
title: 完成设计文档
status: in-progress
groupId: group-abc123
completedPomodoros: 2
lastPomodoroTime: "2026-05-10"
createdAt: 2026-05-10T10:00:00Z
updatedAt: 2026-05-10T12:00:00Z
completedAt: null
```

| 字段 | 类型 | 功能说明 | 对应功能 |
|------|------|---------|---------|
| `title` | string | 任务标题 | 显示在任务列表 |
| `status` | enum | 任务状态：`todo` / `in-progress` / `completed` | 状态筛选、显示样式 |
| `groupId` | string? | 所属分组 ID | 关联 `.meta/entities/groups/{groupId}.yaml` |
| `completedPomodoros` | number | 已完成的番茄数 | 显示在任务项、统计 |
| `lastPomodoroTime` | string? | 最后一次番茄日期（YYYY-MM-DD） | 统计每日番茄数 |
| `createdAt` | string | 创建时间（ISO 8601） | 排序、审计 |
| `updatedAt` | string | 最后修改时间（ISO 8601） | 同步冲突判断、审计 |
| `completedAt` | string? | 完成时间（ISO 8601） | 统计、显示 |

**文件命名：** `{task-id}.yaml`，其中 `task-id` 为 UUID。

**关联关系：**
- `groupId` → `.meta/entities/groups/{groupId}.yaml`
- `id` → `tasks/{task-id}.md`（笔记文件，可选）
- `lastPomodoroTime` → `stats/{date}.yaml`（统计关联）

**状态流转：**
```
todo → in-progress → completed
  ↑___________________|
```
- `todo`：初始状态
- `in-progress`：完成第一个番茄后自动切换
- `completed`：用户手动标记完成

---

### `tasks/{task-id}.md`

任务笔记，纯文本 Markdown 格式。用户可直接编辑。文件可选存在，无笔记则无此文件。

**对应原 SQLite `tasks.notes` 字段，现独立为文件。**

```markdown
# 设计文档

今天完成了同步方案的设计...

## 待办
- [ ] 实现 UI
- [ ] 编写测试
```

| 属性 | 说明 |
|------|------|
| 文件名 | `{task-id}.md`，与 `.meta/entities/tasks/{task-id}.yaml` 同 ID |
| 格式 | 纯文本 Markdown |
| 可选性 | 无笔记内容时不创建此文件 |
| 用户编辑 | 是，用户可直接用编辑器修改 |

**关联关系：**
- 文件名中的 ID → `.meta/entities/tasks/{task-id}.yaml`
- 加载时：读取 YAML 获取元数据，检查是否存在对应 `.md` 文件，存在则作为 `notes` 字段注入

---

### `stats/{date}.yaml`

每日统计。对应原 SQLite `daily_stats` 表。通过一致性维护保持数据正确。

```yaml
totalPomodoros: 5
completedTasks: 3
tasks:
  - task-001
  - task-002
  - task-003
```

| 字段 | 类型 | 功能说明 | 对应功能 |
|------|------|---------|---------|
| `totalPomodoros` | number | 当日完成的番茄总数 | 统计页面显示 |
| `completedTasks` | number | 当日完成的任务数 | 统计页面显示 |
| `tasks` | string[] | 当日有活动的任务 ID 列表 | 统计详情、趋势图 |

**文件命名：** `{date}.yaml`，格式为 `YYYY-MM-DD`，如 `2026-05-10.yaml`。

**一致性维护：**
- 完成番茄时：`totalPomodoros++`，将任务 ID 加入 `tasks`
- 完成任务时：`completedTasks++`，将任务 ID 加入 `tasks`
- 同步时：作为普通数据文件同步，保持一致性

**未来考虑：** 支持从任务元数据重建（当前不实现）

---

## 数据关系

### 实体关系图

```
┌─────────────────┐
│     Group       │
│ (分组)          │
├─────────────────┤
│ id (文件名)     │◄─────────────────┐
│ name            │                  │
│ color           │                  │
│ taskOrder[] ────┼──────┐           │
│ createdAt       │      │           │
│ updatedAt       │      │           │
└─────────────────┘      │           │
                         │           │
                         │ 排序引用  │ groupId
                         │           │
┌─────────────────┐    0..1    ┌─────────────────┐
│     Task        │────────────│   Task Notes    │
│ (任务元数据)    │            │ (任务笔记)      │
├─────────────────┤            ├─────────────────┤
│ id (文件名)     │◄───┐       │ id (文件名)     │
│ title           │    │       │ (Markdown 内容) │
│ status          │    │       └─────────────────┘
│ groupId ────────┘    │
│ completedPomodoros   │              ┌─────────────────┐
│ lastPomodoroTime─────┼──────────────│   Daily Stats   │
│ createdAt        │   │              │ (每日统计)      │
│ updatedAt        │   │              ├─────────────────┤
│ completedAt      │   │              │ date (文件名)   │
└─────────────────┘   │              │ totalPomodoros  │
                      │              │ completedTasks  │
                      │              │ tasks[] ────────┼──┐
                      │              └─────────────────┘  │
                      │                     ▲             │
                      │                     │ tasks 列表   │
                      └─────────────────────┴─────────────┘
```

### 关联关系说明

| 源 | 目标 | 关联方式 | 说明 |
|----|------|---------|------|
| Group | Task | `group.taskOrder[] → task.id` | 分组内任务排序 |
| Task | Group | `task.groupId → group.id` | 任务所属分组 |
| Task | Task Notes | `task.id == notes.id` | 同 ID 的 .md 文件 |
| Task | Daily Stats | `task.lastPomodoroTime → stats.date` | 通过日期关联 |
| Daily Stats | Task | `stats.tasks[] → task.id` | 当日活动任务列表 |

### 数据流

```
用户操作
    │
    ▼
┌─────────────┐
│ 内存状态    │ ←── React Store (Zustand)
└─────────────┘
    │
    ▼
┌─────────────┐
│ 文件系统    │ ←── YAML / Markdown 文件
└─────────────┘
    │
    ▼
┌─────────────┐
│ Git 仓库    │ ←── 版本控制、同步
└─────────────┘
```

**关键决策：**
- `taskOrder` 在分组中，以数组顺序排列 → 创建分支保存本地状态
- 笔记文件可选 → 无笔记时不创建空文件
- 统计通过一致性维护 → 完成番茄/任务时同步更新

---

## 写入流程

### 修改任务元数据

```
用户输入
  → 更新内存状态
  → 更新 updatedAt 字段
  → 写入 .meta/entities/tasks/{id}.yaml
  → 触发异步推送（可选）
```

### 编辑任务笔记

```
用户输入
  → 更新内存状态
  → 写入 tasks/{id}.md
  → 触发异步推送（可选）
```

### 创建任务

```
用户输入
  → 生成 UUID
  → 创建 .meta/entities/tasks/{id}.yaml
  → （如有笔记）创建 tasks/{id}.md
  → 触发异步推送（可选）
```

### 完成番茄钟

```
计时器完成
  → 更新任务 completedPomodoros、lastPomodoroTime
  → 写入 .meta/entities/tasks/{id}.yaml
  → 更新统计 totalPomodoros、tasks 列表
  → 写入 stats/{date}.yaml
  → 触发异步推送（可选）
```

---

## 同步流程

### 启动时自动同步

```
1. 检查 GitHub 认证状态
   └─ 未认证 → 显示登录提示，跳过同步

2. 检查本地仓库状态
   └─ 无仓库 → 克隆远程仓库
   └─ 有仓库 → 继续

3. 提交本地变更（如有）
   git add -A
   git commit -m "sync: local changes before pull"

4. 拉取远程更新
   git pull --rebase origin main

5. 处理结果
   ├─ 成功 → 重建内存状态
   └─ 冲突 → 执行冲突处理流程

6. 更新 UI 状态
```

### 手动同步按钮

```
1. 显示同步状态指示器
2. 执行与启动同步相同的流程
3. 显示同步结果
   ├─ 成功："已同步"
   ├─ 冲突："同步冲突，请手动解决"
   └─ 失败："同步失败：{原因}"
```

### 推送变更

```
1. 检查本地是否有未提交的变更
2. git add -A
3. git commit -m "sync: {timestamp}"
4. git push origin main
5. 处理推送失败
   └─ 远程有新提交 → git pull --rebase → 处理冲突 → 重新 push
```

---

## 冲突处理

**原则：保护本地数据，让用户自行解决冲突。**

### 冲突场景

同步过程中 `git pull --rebase` 返回非零退出码时，判定为冲突。

### 冲突处理流程

```
检测到冲突时：

1. 保持 rebase 冲突状态（不 abort）
   - Git 已标记冲突文件
   - 本地数据仍在，未被覆盖

2. 创建保存分支
   git branch "conflict-{timestamp}"

3. 中止 rebase，恢复到 pull 前状态
   git rebase --abort

4. 提示用户有冲突，需要手动解决
```

### 用户操作流程

用户在终端手动解决冲突：

```
1. 进入数据目录
   cd {tomato-data-path}

2. 从保存分支合并
   git merge conflict-{timestamp}

3. 此时会显示冲突文件列表
   Git 会标记冲突内容（<<<<<<< / ======= / >>>>>>>）

4. 手动编辑冲突文件，保留正确内容

5. 标记冲突已解决
   git add .
   git commit -m "resolve sync conflict"

6. 推送到远程
   git push origin main

7. 回到应用，点击"同步完成"按钮
```

### 应用检测冲突解决

```
用户点击"同步完成"后：

1. 检查 git status 是否干净
   └─ 有未提交变更 → 提示"请先提交解决后的变更"
   └─ 干净 → 继续

2. 检查本地分支与远程是否同步
   git fetch origin
   git status
   └─ behind → 提示"请先 push 到远程"
   └─ 同步 → 删除冲突分支，恢复正常状态

3. 删除冲突分支
   git branch -d conflict-{timestamp}
```

### 用户提示面板

```
┌─────────────────────────────────────┐
│ ⚠ 同步冲突                           │
├─────────────────────────────────────┤
│ 远程数据与本地数据存在冲突。          │
│                                     │
│ 本地数据已保存到分支：                │
│ conflict-2026-05-10-143022          │
│                                     │
│ 请在终端手动解决：                    │
│                                     │
│ 1. cd ~/Library/Application Support/ │
│    tomato-app/tomato-data            │
│ 2. git merge conflict-2026-05-10-*   │
│ 3. 编辑冲突文件，保留正确内容          │
│ 4. git add . && git commit           │
│ 5. git push origin main              │
│                                     │
│ [复制路径]  [打开终端]                │
│                                     │
│ 解决后点击下方按钮：                  │
│ [同步完成]                           │
└─────────────────────────────────────┘
```

### 状态机

```
正常状态 ──同步──→ 检查冲突
                      │
                      ├─ 无冲突 → 正常状态
                      │
                      └─ 有冲突 → 冲突状态
                                    │
                                    └─ 用户解决 → 同步完成 → 正常状态
```

| 状态 | 说明 | 可用操作 |
|------|------|---------|
| 正常 | 无冲突，可正常使用 | 同步、编辑、查看 |
| 冲突 | 检测到冲突，等待解决 | 打开终端、复制路径、同步完成 |

---

## GitHub 认证

### OAuth 授权流程

```
1. 用户点击"登录 GitHub"
2. 应用启动本地 HTTP 服务（随机端口）
3. 打开浏览器访问 GitHub OAuth 授权页面
   https://github.com/login/oauth/authorize
   ?client_id={CLIENT_ID}
   &redirect_uri=http://localhost:{port}/callback
   &scope=repo
4. 用户授权
5. GitHub 重定向到本地服务，携带 code 参数
6. 应用用 code 换取 access_token
7. 安全存储 token
8. 关闭本地 HTTP 服务
```

### Token 存储

使用系统密钥库安全存储：

| 平台 | 存储方式 |
|------|---------|
| macOS | Keychain |
| Windows | Credential Manager |
| Linux | Secret Service API (libsecret) |

### 仓库管理

```
1. 检查用户是否已有 tomato-data 仓库
   GET /user/repos

2. 有 → 直接使用
   无 → 提供选项：
   - 创建新私有仓库 "tomato-data"
   - 选择现有仓库

3. 克隆到本地数据目录
   {userData}/tomato-data/
```

---

## UI 设计

### 同步状态指示

侧边栏底部显示同步图标：

| 状态 | 图标 | 颜色 |
|------|------|------|
| 已同步 | ✓ | 绿色 |
| 同步中 | ↻ 动画 | 蓝色 |
| 有冲突 | ⚠ | 黄色 |
| 离线 | ✗ | 灰色 |

点击图标显示同步详情面板。

### 同步设置页面

```
┌─────────────────────────────────────┐
│ 同步设置                             │
├─────────────────────────────────────┤
│ GitHub 账户                          │
│ 已登录：@username                    │
│ [退出登录]                           │
│                                     │
│ 同步仓库                             │
│ username/tomato-data                │
│ [更换仓库]                           │
│                                     │
│ 同步方式                             │
│ ☑ 启动时自动同步                     │
│ ☑ 关闭时自动推送                     │
│                                     │
│ [立即同步]                           │
│                                     │
│ 上次同步：2026-05-10 14:30          │
└─────────────────────────────────────┘
```

### 冲突提示面板

```
┌─────────────────────────────────────┐
│ 同步冲突                             │
├─────────────────────────────────────┤
│ 检测到同步冲突，本地数据已保存。      │
│                                     │
│ 请在终端手动解决：                    │
│ 1. cd ~/Library/Application Support/ │
│    tomato-app/tomato-data            │
│ 2. git status                        │
│ 3. 手动合并冲突文件                   │
│ 4. git add . && git commit           │
│ 5. git push                          │
│                                     │
│ [复制路径]  [打开终端]                │
│                                     │
│ 解决后点击下方按钮继续：              │
│ [重新同步]                           │
└─────────────────────────────────────┘
```

---

## 架构变更

### 新增模块

```
packages/core/
├── storage/
│   ├── file-storage.ts         # 文件读写操作
│   ├── yaml-serializer.ts      # YAML 解析/序列化
│   ├── task-file-repo.ts       # 任务文件仓库实现
│   └── group-file-repo.ts      # 分组文件仓库实现
├── sync/
│   ├── github-auth.ts          # GitHub OAuth
│   ├── git-client.ts           # Git 命令封装
│   └── sync-manager.ts         # 同步协调器
└── types/
    └── sync.ts                 # 同步相关类型

tomato_app/
├── src/main/
│   ├── sync/
│   │   ├── sync-service.ts     # 主进程同步服务
│   │   ├── oauth-server.ts     # OAuth 回调服务
│   │   └── keychain.ts         # 系统密钥库封装
│   └── ipc-handlers.ts         # 新增同步 IPC
└── src/renderer/
    ├── components/Sync/
    │   ├── SyncStatus.tsx      # 同步状态指示
    │   ├── SyncSettings.tsx    # 同步设置页
    │   └── ConflictPrompt.tsx  # 冲突提示面板
    └── stores/sync-store.ts    # 同步状态管理
```

### 废弃模块

```
packages/core/src/db/           # SQLite 存储层（完全移除）
```

### 接口保留

`ITaskRepository`、`ITaskGroupRepository` 接口保留，新增文件存储实现。

---

## 操作场景分析

### 低风险操作（单文件）

| 操作 | 涉及文件 | 冲突风险 |
|------|---------|---------|
| 修改任务标题 | 1 | 低 |
| 编辑笔记 | 1 | 低 |
| 修改设置 | 1 | 低 |
| 创建分组 | 1 | 低 |
| 完成番茄钟 | 2 | 低 |

### 中风险操作（多文件）

| 操作 | 涉及文件 | 冲突风险 |
|------|---------|---------|
| 创建任务 | 1 | 中（同分组并发创建） |
| 删除任务 | 1-2 | 中 |
| 排序任务 | 1 | 中（同分组并发排序） |

### 高风险操作（级联）

| 操作 | 涉及文件 | 冲突风险 |
|------|---------|---------|
| 删除分组 | N（分组+所有任务） | 高 |

---

## 实现优先级

### Phase 1：文件存储

1. 文件结构定义
2. YAML 序列化/反序列化
3. Repository 文件实现
4. 移除 SQLite

### Phase 2：同步基础

1. Git 命令封装
2. 同步管理器
3. 冲突检测和中止

### Phase 3：认证

1. GitHub OAuth
2. Token 安全存储
3. 仓库管理

### Phase 4：UI

1. 同步状态指示
2. 同步设置页面
3. 冲突提示面板
