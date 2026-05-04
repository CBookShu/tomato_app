# 番茄工作法桌面应用 - 设计文档

**创建日期**: 2025-05-04
**版本**: 1.0
**状态**: 待审查

## 项目概述

构建一个跨平台的番茄工作法（Pomodoro Technique）桌面应用，从 macOS 开始，为未来扩展到移动端预留架构空间。

### 核心目标

- 提供简洁高效的番茄计时功能
- 支持任务管理和统计报告
- 系统托盘常驻，快速访问
- 未来支持多平台（桌面 + 移动端）

### 第一版范围

- ✅ macOS桌面应用（Electron）
- ✅ 番茄计时器核心功能
- ✅ 任务管理（分组、排序）
- ✅ 系统托盘集成
- ✅ 本地数据存储（SQLite）
- ❌ GitHub同步（后续版本）
- ❌ 移动端应用（仅预留架构）

---

## 一、架构设计

### 1.1 项目结构

```
pomodoro-app/                 # 根项目（Monorepo）
├── packages/
│   ├── core/                # 共享核心逻辑包 (TypeScript)
│   │   ├── src/
│   │   │   ├── pomodoro/    # 番茄计时逻辑
│   │   │   ├── tasks/       # 任务管理逻辑
│   │   │   ├── stats/       # 统计计算
│   │   │   ├── types/       # 共享类型定义
│   │   │   └── utils/       # 工具函数
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── desktop/             # 桌面应用包 (Electron + React)
│   │   ├── src/
│   │   │   ├── main/        # Electron主进程
│   │   │   ├── renderer/    # React渲染进程
│   │   │   │   ├── components/
│   │   │   │   ├── pages/
│   │   │   │   ├── hooks/
│   │   │   │   └── utils/
│   │   │   └── shared/      # 主进程与渲染进程共享代码
│   │   ├── package.json
│   │   └── electron-builder.yml
│   │
│   └── mobile/              # 移动端应用（预留）
│       ├── src/
│       └── package.json     # 基础结构预留
│
├── docs/                    # 项目文档
│   └── superpowers/specs/   # 设计文档
├── package.json             # Workspace根配置
└── README.md
```

### 1.2 模块职责

#### packages/core (共享核心层)
- **番茄计时器**：状态机管理、计时算法、循环逻辑
- **任务管理**：任务增删改查、分组管理、排序算法
- **统计计算**：日/周/月统计数据生成
- **类型定义**：共享的TypeScript接口和类型
- **工具函数**：通用工具方法（日期处理、ID生成等）

#### packages/desktop (桌面应用层)
- **主进程**：Electron主进程、系统托盘、窗口管理、SQLite数据库
- **渲染进程**：React应用、UI组件、用户交互
- **系统集成**：通知、快捷键、自动启动

#### packages/mobile (预留层)
- 第一版仅保留基础目录结构，为未来React Native应用预留

---

## 二、技术栈选择

### 2.1 核心共享层 (core)

- **语言**: TypeScript 5.x
- **包管理**: npm workspaces
- **构建工具**: tsc + esbuild
- **测试框架**: Jest + Testing Library
- **代码质量**: ESLint + Prettier + TypeScript严格模式

### 2.2 桌面应用层 (desktop)

#### 框架与运行时
- **Electron**: v31.x（最新稳定版）
- **React**: v18.x
- **TypeScript**: v5.x

#### UI与样式
- **UI组件库**: shadcn/ui + Radix UI
- **样式方案**: Tailwind CSS
- **图标**: Lucide React

#### 状态与数据管理
- **状态管理**: Zustand（轻量级，适合Electron）
- **数据存储**: SQLite（better-sqlite3）
- **ORM**: Drizzle ORM（类型安全查询）

#### 开发工具
- **构建工具**: Vite + electron-builder
- **热重载**: electron-reload
- **调试**: Electron DevTools

#### 系统集成
- **托盘**: Electron原生Tray API
- **通知**: Electron Notification API
- **快捷键**: electron-localshortcut
- **自动启动**: auto-launch

---

## 三、核心功能设计

### 3.1 番茄计时器

#### 状态机设计

```
状态定义：
- Idle (空闲)
- Working (番茄时间)
- Paused (暂停)
- Breaking (休息时间)
- LongBreak (长休息)

状态转换：
1. Idle → Working [用户手动开始]
2. Working → Paused [用户手动暂停]
3. Paused → Working [用户手动恢复]
4. Working → Idle [用户手动停止]
5. Working → Breaking [25分钟结束，自动切换]
6. Working (第4次) → LongBreak [每4个番茄周期]
7. Breaking → Idle [休息结束，等待用户]
8. LongBreak → Idle [长休息结束，等待用户]

关键规则：
- 番茄时间默认25分钟
- 短休息默认5分钟
- 长休息默认15分钟（每4个番茄后）
- 休息结束后回到Idle状态，需用户手动开始新番茄
- 支持自定义时长（设置中配置）
```

#### 计时器核心逻辑

```typescript
interface PomodoroTimer {
  // 状态
  status: TimerStatus;
  remainingTime: number;  // 剩余时间（秒）
  currentCycle: number;   // 当前周期计数（1-4）
  currentTaskId?: string; // 当前关联的任务ID

  // 操作
  start(taskId?: string): void;
  pause(): void;
  resume(): void;
  stop(): void;
  skip(): void;  // 跳过当前番茄/休息

  // 事件回调
  onStatusChange: (status: TimerStatus) => void;
  onTick: (remainingTime: number) => void;
  onComplete: (type: 'work' | 'break') => void;
}
```

### 3.2 任务管理

#### 数据模型

```typescript
// 任务组
interface TaskGroup {
  id: string;                    // UUID v4
  name: string;                  // 组名
  color?: string;                // 颜色标识（可选）
  taskOrder: string[];           // 任务ID的顺序数组
  createdAt: string;             // ISO日期
  updatedAt: string;             // ISO日期
}

// 任务
interface Task {
  id: string;                    // UUID v4
  title: string;                 // 任务标题（必填）
  description?: string;          // 任务描述（可选）
  completedPomodoros: number;    // 已完成番茄数（默认0）
  status: 'todo' | 'in-progress' | 'completed';
  groupId?: string;              // 所属组ID
  lastPomodoroTime?: string;     // 最近番茄时间
  tags?: string[];               // 标签（可选）
  createdAt: string;             // ISO日期
  updatedAt: string;             // ISO日期
  completedAt?: string;          // 完成时间
}
```

#### 排序方案

**设计原则**: 在组级别维护taskOrder数组，避免position字段冲突

```typescript
// 组对象中存储任务顺序
const group = {
  id: 'group-1',
  name: '开发项目',
  taskOrder: ['task-3', 'task-1', 'task-5']  // 顺序即为此数组的顺序
};

// 新增任务到指定位置
function addTaskAtPosition(
  group: TaskGroup,
  taskId: string,
  referenceTaskId?: string,
  insertAfter: boolean = true
) {
  if (!referenceTaskId) {
    // 添加到末尾
    group.taskOrder.push(taskId);
  } else {
    const refIndex = group.taskOrder.indexOf(referenceTaskId);
    if (refIndex === -1) {
      group.taskOrder.push(taskId);
    } else {
      const insertIndex = insertAfter ? refIndex + 1 : refIndex;
      group.taskOrder.splice(insertIndex, 0, taskId);
    }
  }
}

// 拖拽重新排序
function reorderTasks(group: TaskGroup, taskId: string, newIndex: number) {
  const oldIndex = group.taskOrder.indexOf(taskId);
  if (oldIndex !== -1) {
    group.taskOrder.splice(oldIndex, 1);
    group.taskOrder.splice(newIndex, 0, taskId);
  }
}
```

#### 任务操作

```
基础操作：
- 创建任务：指定位置（右键菜单上方/下方）或组末尾
- 编辑任务：修改标题、描述、标签
- 删除任务：从组中移除，更新taskOrder数组
- 完成任务：标记为completed，移动到组末尾
- 拖拽排序：修改组taskOrder数组

组操作：
- 创建组：新建任务组
- 重命名组：修改组名
- 删除组：删除组及其所有任务
- 展开/折叠组：UI交互功能

任务分配：
- 未分组任务：放入默认组（id: 'default'）
- 移动到组：将任务分配到不同组
```

### 3.3 统计报告

#### 数据模型

```typescript
// 每日统计
interface DailyStats {
  date: string;                  // "2025-05-04"
  totalPomodoros: number;        // 总番茄数
  completedTasks: number;        // 完成任务数
  tasks: string[];               // 完成的任务ID列表
}

// 月度统计
interface MonthlyStats {
  month: string;                 // "2025-05"
  dailyStats: DailyStats[];      // 每日统计数据
}
```

#### 统计维度

```
今日统计：
- 完成番茄数
- 专注时长（分钟）
- 完成任务数
- 当前活跃任务

本周趋势：
- 每日完成番茄数折线图
- 周累计番茄数
- 周对比上周增长率

月度报告：
- 任务完成分布图
- 专注时段热力图（按小时统计）
- 完成率统计
```

---

## 四、系统集成设计

### 4.1 系统托盘

#### 托盘图标设计

```
设计原则：
1. 照顾色盲用户：使用形状区分状态，不依赖颜色
2. macOS原生风格：简洁清晰
3. 倒计时显示：直观展示剩余时间

状态图标：
- 空闲：🍅 灰色番茄图标
- 工作中：🍅 番茄图标 + 倒计时数字（如"25" → "1"）
- 休息中：☕ 咖啡杯图标 + 倒计时数字
- 暂停：⏸️ 暂停图标
```

#### 托盘菜单（简化版）

```
右键菜单结构：
┌─────────────────────────────┐
│ 当前任务: 开发番茄应用        │
│ 状态: 工作中 (剩余22:15)     │
├─────────────────────────────┤
│ 打开应用                     │
│ 跳转到当前任务               │
├─────────────────────────────┤
│ 退出                        │
└─────────────────────────────┘

功能说明：
- 顶部显示当前任务和状态（只读信息）
- "打开应用"：显示/聚焦主窗口
- "跳转到当前任务"：打开应用并定位到当前任务
- "退出"：关闭应用

左键单击：切换显示/隐藏主窗口
```

### 4.2 通知系统

```
通知原则：
1. 不打扰主界面工作
2. 弱样式：右下角/右上角显示
3. 自动关闭：3-5秒后消失
4. 可点击：快速定位到应用

通知类型：
- 🍅 番茄时间结束 - 该休息了！
- ☕ 休息时间结束 - 可以继续工作了
- 🎯 今日目标完成 - 已完成8个番茄！

技术实现：
- Electron原生Notification API
- autoClose: true
- 支持静音模式（设置中配置）
```

### 4.3 快捷键

```
全局快捷键（可自定义）：
- Cmd/Ctrl + Shift + P：开始/暂停番茄
- Cmd/Ctrl + Shift + S：停止当前番茄
- Cmd/Ctrl + Shift + N：快速添加任务

应用内快捷键：
- Cmd/Ctrl + N：新建任务
- Cmd/Ctrl + ,：打开设置
- Cmd/Ctrl + Q：退出应用
- Escape：关闭对话框/取消操作
```

---

## 五、数据存储设计

### 5.1 本地数据库

#### SQLite表结构

```sql
-- 任务组表
CREATE TABLE task_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  task_order TEXT NOT NULL,  -- JSON数组: ["task-id-1", "task-id-2"]
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 任务表
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  completed_pomodoros INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'todo',
  group_id TEXT,
  last_pomodoro_time TEXT,
  tags TEXT,  -- JSON数组
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (group_id) REFERENCES task_groups(id)
);

-- 统计表
CREATE TABLE daily_stats (
  date TEXT PRIMARY KEY,
  total_pomodoros INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  tasks TEXT NOT NULL  -- JSON数组: ["task-id-1", "task-id-2"]
);

-- 应用设置表
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

#### 数据访问层

```typescript
// 使用Drizzle ORM
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, desc } from 'drizzle-orm';

// 示例：任务仓库
class TaskRepository {
  async create(task: NewTask): Promise<Task> {
    return await db.insert(tasks).values(task).returning();
  }

  async findByGroup(groupId: string): Promise<Task[]> {
    return await db.select()
      .from(tasks)
      .where(eq(tasks.groupId, groupId))
      .orderBy(tasks.createdAt);
  }

  async updateTaskOrder(groupId: string, taskOrder: string[]): Promise<void> {
    await db.update(taskGroups)
      .set({ taskOrder: JSON.stringify(taskOrder) })
      .where(eq(taskGroups.id, groupId));
  }
}
```

---

## 六、UI设计规范

### 6.1 主窗口布局

```
┌─────────────────────────────────────────────┐
│  🍅 番茄工作法                      ⚙️ 设置  │
├─────────────────────────────────────────────┤
│                                             │
│         ⏱️  22:15                           │
│      [开始] [暂停] [跳过]                    │
│                                             │
├─────────────────────────────────────────────┤
│  📋 任务列表          │  📊 今日统计        │
│                       │                     │
│  ▼ 开发项目 (3/5)     │  番茄数: 6          │
│    ✓ 设计UI原型       │  专注: 2.5h         │
│    → 开发番茄计时器   │  完成: 3任务        │
│    ○ 编写测试用例     │                     │
│                       │  [查看详细报告]     │
│  ▶ 学习计划 (0/2)     │                     │
│    ○ 学习Rust基础     │                     │
│                       │                     │
│  [+ 新建任务]         │                     │
└─────────────────────────────────────────────┘

布局说明：
- 顶部：应用标题、计时器大面板、控制按钮
- 左侧：任务列表（60%宽度）
- 右侧：统计面板（40%宽度）
- 底部：快速操作按钮
```

### 6.2 设置窗口布局

```
┌─────────────────────────────────────────────┐
│  ← 设置                                     │
├─────────────────────────────────────────────┤
│  计时设置                                   │
│  ┌─────────────────────────────────────┐   │
│  │ 番茄时长: 25 分钟                    │   │
│  │ 短休息: 5 分钟                       │   │
│  │ 长休息: 15 分钟                      │   │
│  │ 长休息间隔: 4 个番茄                 │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  通知设置                                   │
│  ┌─────────────────────────────────────┐   │
│  │ [✓] 启用声音提醒                     │   │
│  │ [✓] 启用系统通知                     │   │
│  │ 免打扰时段: 22:00 - 08:00            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  外观设置                                   │
│  ┌─────────────────────────────────────┐   │
│  │ 主题: ⚪ 亮色 / ⚫ 暗色 / 🔄 自动     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  高级设置                                   │
│  ┌─────────────────────────────────────┐   │
│  │ [✓] 开机自启动                       │   │
│  │ [ ] 隐藏到托盘（关闭时）             │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 6.3 设计系统

```
颜色方案（支持暗色模式）：
- 主色：#EF4444 (红色，番茄色)
- 成功色：#10B981 (绿色，完成状态)
- 警告色：#F59E0B (橙色，提醒)
- 背景色：#FFFFFF / #1F2937 (亮色/暗色)
- 文本色：#111827 / #F9FAFB (亮色/暗色)

字体：
- 标题：Inter / SF Pro Display (macOS)
- 正文：Inter / SF Pro Text
- 数字：JetBrains Mono（计时器数字）

间距系统：
- 基础单位：4px
- 小间距：8px
- 中间距：16px
- 大间距：24px
- 特大间距：32px

圆角：
- 小按钮：4px
- 卡片：8px
- 对话框：12px
```

---

## 七、开发计划

### 7.1 开发阶段

#### 第一阶段：核心功能（2-3周）
- [ ] 项目初始化（Monorepo + Electron + React）
- [ ] 番茄计时器核心逻辑
- [ ] 系统托盘基础功能
- [ ] 本地数据库设计与实现
- [ ] 基础UI框架搭建

#### 第二阶段：任务管理（2周）
- [ ] 任务CRUD功能
- [ ] 任务组管理
- [ ] 拖拽排序功能
- [ ] 任务与番茄关联

#### 第三阶段：统计与优化（1-2周）
- [ ] 统计数据计算
- [ ] 图表可视化
- [ ] 设置页面
- [ ] 快捷键集成

#### 第四阶段：打磨与测试（1周）
- [ ] UI细节优化
- [ ] 性能优化
- [ ] 测试覆盖
- [ ] 打包与分发

### 7.2 技术债务与限制

```
第一版限制：
- 仅支持macOS（后续扩展Windows/Linux）
- 不支持GitHub同步（后续版本）
- 不支持移动端（仅预留架构）
- 不支持任务导入/导出（后续版本）
- 不支持多语言（仅中文）

未来优化方向：
- 添加GitHub同步功能
- 开发移动端应用（React Native）
- 支持第三方日历集成
- 支持团队协作功能
- 多语言支持（i18n）
```

---

## 八、质量保证

### 8.1 测试策略

```
单元测试：
- 番茄计时器状态机
- 任务排序算法
- 统计计算逻辑
- 工具函数

集成测试：
- 数据库CRUD操作
- Electron IPC通信
- 系统托盘交互

E2E测试：
- 完整番茄周期流程
- 任务管理流程
- 设置保存与加载

测试覆盖率目标：≥ 80%
```

### 8.2 性能指标

```
启动时间：< 2秒
内存占用：< 100MB（空闲状态）
CPU占用：< 1%（计时状态）
数据库查询：< 50ms
UI响应时间：< 100ms
```

### 8.3 代码质量

```
代码规范：
- ESLint + Prettier自动格式化
- TypeScript严格模式
- 命名规范：camelCase（变量/函数）、PascalCase（组件/类型）
- 文件结构：一个文件一个主要组件/类

代码审查：
- 每个PR需要代码审查
- 关键模块需要单元测试
- 遵循Git工作流（分支、提交规范）
```

---

## 九、部署与分发

### 9.1 打包配置

```yaml
# electron-builder.yml
appId: com.pomodoro.app
productName: 番茄工作法

mac:
  category: public.app-category.productivity
  icon: build/icon.icns
  target:
    - dmg
    - zip

dmg:
  contents:
    - x: 110
      y: 150
    - x: 240
      y: 150
      type: link
      path: /Applications
```

### 9.2 自动更新

```typescript
import { autoUpdater } from 'electron-updater';

autoUpdater.checkForUpdatesAndNotify();

// 配置更新服务器
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'username',
  repo: 'pomodoro-app'
});
```

---

## 十、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Electron性能问题 | 中 | 优化渲染进程，减少IPC通信 |
| SQLite并发问题 | 低 | 使用better-sqlite3的同步API |
| 系统托盘兼容性 | 低 | 测试不同macOS版本 |
| 打包体积过大 | 中 | 代码分割，按需加载 |
| 数据迁移问题 | 高 | 版本化数据库，迁移脚本 |

---

## 附录

### A. 参考资料

- [Electron官方文档](https://www.electronjs.org/docs)
- [React文档](https://react.dev)
- [番茄工作法](https://francescocirillo.com/products/the-pomodoro-technique)
- [shadcn/ui组件库](https://ui.shadcn.com)
- [Drizzle ORM](https://orm.drizzle.team)

### B. 开发环境设置

```bash
# 克隆项目
git clone https://github.com/username/pomodoro-app.git
cd pomodoro-app

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test

# 打包应用
npm run build
```

### C. Git工作流

```
分支策略：
- main: 生产分支
- develop: 开发分支
- feature/*: 功能分支
- hotfix/*: 紧急修复分支

提交规范：
- feat: 新功能
- fix: 修复bug
- refactor: 重构
- docs: 文档更新
- test: 测试相关
- chore: 构建/工具链更新
```

---

**文档结束**
