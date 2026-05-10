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

应用全局设置。

```yaml
pomodoroDuration: 25
shortBreakDuration: 5
longBreakDuration: 15
soundEnabled: true
notificationEnabled: true
```

### `.meta/entities/groups/{group-id}.yaml`

分组元数据。`taskOrder` 移到任务中，此处只保留分组自身属性。

```yaml
name: 工作
color: blue
createdAt: 2026-05-10T10:00:00Z
updatedAt: 2026-05-10T12:00:00Z
```

### `.meta/entities/tasks/{task-id}.yaml`

任务元数据。包含 `order` 字段用于组内排序，`groupId` 关联分组。

```yaml
title: 完成设计文档
status: in-progress
groupId: group-abc123
completedPomodoros: 2
lastPomodoroTime: "2026-05-10"
order: 1
tags:
  - design
  - sync
createdAt: 2026-05-10T10:00:00Z
updatedAt: 2026-05-10T12:00:00Z
completedAt: null
```

### `tasks/{task-id}.md`

任务笔记，纯文本 Markdown 格式。用户可直接编辑。文件可选存在，无笔记则无此文件。

```markdown
# 设计文档

今天完成了同步方案的设计...

## 待办
- [ ] 实现 UI
- [ ] 编写测试
```

### `stats/{date}.yaml`

每日统计。此文件可从任务元数据重建，非权威数据源。

```yaml
totalPomodoros: 5
completedTasks: 3
tasks:
  - task-001
  - task-002
  - task-003
```

---

## 数据关系

```
分组 (group) 1──N 任务
任务 0..1──1 笔记
任务 N──N 统计
```

**关键决策：**
- `order` 在任务中，不在分组中 → 排序操作只修改单个任务文件
- 笔记文件可选 → 无笔记时不创建空文件
- 统计可重建 → 同步冲突时可丢弃远程版本

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

**原则：不自动解决冲突，安全中止并提示用户。**

### 冲突检测

`git pull --rebase` 返回非零退出码时，判定为冲突。

### 冲突处理流程

```
1. git rebase --abort（中止 rebase，恢复到 pull 前状态）

2. 保存本地状态到临时分支
   git branch "conflict-backup-{timestamp}"

3. 重置到远程状态
   git fetch origin
   git reset --hard origin/main

4. 保存本地变更到待同步目录
   将本地变更复制到 .meta/pending-sync/

5. 显示用户提示
```

### 用户提示内容

```
检测到同步冲突

本地数据已保存到 .meta/pending-sync/
远程数据已更新到本地

请在终端手动解决冲突：
1. cd {tomato-data-path}
2. git checkout conflict-backup-{timestamp}
3. 手动合并变更
4. git add . && git commit -m "resolve conflict"
5. git push origin main

解决后点击"重新同步"继续
```

### 重新同步

用户手动解决冲突后：

```
1. 检查 .meta/pending-sync/ 是否存在
2. 如存在，提示用户是否已手动合并
3. 用户确认后，删除 pending-sync 目录
4. 重新执行正常同步流程
```

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
