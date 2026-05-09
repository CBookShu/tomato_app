import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import { PomodoroTimer, Task, TaskGroup, DailyStats } from '@pomodoro/core';
import type { TaskManager, StatsRepository, SettingsRepository } from '@pomodoro/core';
import type { PomodoroConfig } from '@pomodoro/core';
import { updateTrayIcon, updateTrayTime, setTrayTaskTitle } from './tray.js';
import type { TimerStatus } from './tray.js';
import { clearAllData, getSqlite } from './database.js';
import { safeSend } from './safe-send.js';

// ExportData 类型定义（与 shared/ipc-channels.ts 保持一致）
interface ExportDataPayload {
  version: string;
  exportedAt: string;
  data: {
    tasks: Task[];
    groups: TaskGroup[];
    stats: DailyStats[];
    settings: Record<string, string>;
  };
}

let timer: PomodoroTimer | null = null;
let taskManager: TaskManager | null = null;
let statsRepo: StatsRepository | null = null;
let settingsRepo: SettingsRepository | null = null;
let currentWindow: BrowserWindow | null = null;
let onPomodoroComplete: (() => void) | null = null;
let onBreakComplete: (() => void) | null = null;
let currentTimerStatus: TimerStatus = 'idle';
let currentRemainingTime: number = 0;

async function getTimerConfig(): Promise<Partial<PomodoroConfig>> {
  // 测试环境优先使用环境变量
  if (process.env.NODE_ENV === 'test') {
    return {
      pomodoroDuration: parseInt(process.env.TEST_POMODORO_DURATION || '5', 10),
      shortBreakDuration: parseInt(process.env.TEST_BREAK_DURATION || '3', 10),
      longBreakDuration: parseInt(process.env.TEST_LONG_BREAK_DURATION || '5', 10),
      longBreakInterval: 4,
    };
  }

  // 生产环境从设置读取
  if (!settingsRepo) {
    return {};
  }

  const pomodoroDuration = (await settingsRepo.get('pomodoro_duration')) ?? '25';
  const shortBreak = (await settingsRepo.get('short_break')) ?? '5';
  const longBreak = (await settingsRepo.get('long_break')) ?? '15';
  const longBreakInterval = (await settingsRepo.get('long_break_interval')) ?? '4';

  return {
    pomodoroDuration: parseInt(pomodoroDuration, 10) * 60,
    shortBreakDuration: parseInt(shortBreak, 10) * 60,
    longBreakDuration: parseInt(longBreak, 10) * 60,
    longBreakInterval: parseInt(longBreakInterval, 10),
  };
}

function setupTimerEvents(t: PomodoroTimer, win: BrowserWindow | null): void {
  t.on('tick', (remainingTime: number) => {
    currentRemainingTime = remainingTime;
    safeSend(win, IPC.TIMER_TICK, remainingTime);
    updateTrayTime(currentTimerStatus, remainingTime);
  });
  t.on('statusChange', (status: string, remainingTime: number) => {
    currentTimerStatus = status as TimerStatus;
    currentRemainingTime = remainingTime;
    const state = t.getState();
    safeSend(win, IPC.TIMER_STATUS_CHANGE, status, remainingTime, state.currentTaskId);
    if (status === 'idle') {
      setTrayTaskTitle(undefined);
    }
    updateTrayIcon(status as TimerStatus, remainingTime);
  });
  t.on('complete', (type: 'work' | 'break') => {
    safeSend(win, IPC.TIMER_COMPLETE, type);
    // Show notification directly from main process
    if (type === 'work') {
      onPomodoroComplete?.();
    } else {
      onBreakComplete?.();
    }
  });
}

async function getTimer(): Promise<PomodoroTimer> {
  if (!timer) {
    const config = await getTimerConfig();
    timer = new PomodoroTimer(config);
    setupTimerEvents(timer, currentWindow);
  }
  return timer;
}

// Update timer config when settings change - recreate timer with new config
async function updateTimerConfig(): Promise<void> {
  if (timer) {
    // Destroy old timer to clean up intervals
    timer.destroy();
    // Create new timer with updated config
    const config = await getTimerConfig();
    timer = new PomodoroTimer(config);
    setupTimerEvents(timer, currentWindow);
  }
}

export function registerIpcHandlers(
  getWindow: () => BrowserWindow | null,
  _taskManager?: TaskManager,
  _statsRepo?: StatsRepository,
  _settingsRepo?: SettingsRepository,
  callbacks?: {
    onPomodoroComplete?: () => void;
    onBreakComplete?: () => void;
  },
) {
  taskManager = _taskManager ?? null;
  statsRepo = _statsRepo ?? null;
  settingsRepo = _settingsRepo ?? null;
  onPomodoroComplete = callbacks?.onPomodoroComplete ?? null;
  onBreakComplete = callbacks?.onBreakComplete ?? null;

  // Timer handlers
  ipcMain.handle(IPC.TIMER_START, async (_event, payload?: { taskId?: string }) => {
    currentWindow = getWindow();
    const t = await getTimer();
    t.start(payload?.taskId);
    return t.getState();
  });

  ipcMain.handle(IPC.TIMER_PAUSE, async () => (await getTimer()).pause());
  ipcMain.handle(IPC.TIMER_RESUME, async () => (await getTimer()).resume());
  ipcMain.handle(IPC.TIMER_STOP, async () => (await getTimer()).stop());
  ipcMain.handle(IPC.TIMER_SKIP, async () => (await getTimer()).skip());
  ipcMain.handle(IPC.TIMER_STATE, async () => (await getTimer()).getState());

  // Tray action handlers - forward to timer actions
  ipcMain.handle(IPC.TRAY_PAUSE, async () => (await getTimer()).pause());
  ipcMain.handle(IPC.TRAY_STOP, async () => (await getTimer()).stop());
  ipcMain.handle(IPC.TRAY_SKIP_BREAK, async () => (await getTimer()).skip());

  // Task handlers (only if taskManager injected)
  if (taskManager) {
    ipcMain.handle(IPC.TASK_CREATE, async (_e, payload) => {
      return taskManager!.createTask(payload.input, payload.referenceTaskId, payload.insertAfter);
    });
    ipcMain.handle(IPC.TASK_GET, async (_e, payload) => taskManager!.getTask(payload.id));
    ipcMain.handle(IPC.TASK_GET_ALL, async () => taskManager!.getAllTasks());
    ipcMain.handle(IPC.TASK_GET_BY_STATUS, async (_e, payload) => taskManager!.getTasksByStatus(payload.status));
    ipcMain.handle(IPC.TASK_EDIT, async (_e, payload) => taskManager!.editTask(payload.id, payload.updates));
    ipcMain.handle(IPC.TASK_COMPLETE, async (_e, payload) => {
      const result = await taskManager!.completeTask(payload.id);
      safeSend(currentWindow, IPC.TASK_COMPLETE_EVENT, payload.id);
      return result;
    });
    ipcMain.handle(IPC.TASK_DELETE, async (_e, payload) => taskManager!.deleteTask(payload.id));
    ipcMain.handle(IPC.TASK_MOVE_TO_GROUP, async (_e, payload) =>
      taskManager!.moveTaskToGroup(payload.taskId, payload.newGroupId),
    );
    ipcMain.handle(IPC.TASK_REORDER, async (_e, payload) =>
      taskManager!.reorderTask(payload.taskId, payload.newIndex),
    );
    ipcMain.handle(IPC.TASK_INCREMENT_POMODORO, async (_e, payload) =>
      taskManager!.incrementPomodoro(payload.id, payload.dateStr),
    );

    ipcMain.handle(IPC.GROUP_CREATE, async (_e, payload) => taskManager!.createGroup(payload.input));
    ipcMain.handle(IPC.GROUP_GET, async (_e, payload) => taskManager!.getGroup(payload.id));
    ipcMain.handle(IPC.GROUP_GET_ALL, async () => taskManager!.getAllGroups());
    ipcMain.handle(IPC.GROUP_RENAME, async (_e, payload) => taskManager!.renameGroup(payload.id, payload.name));
    ipcMain.handle(IPC.GROUP_DELETE, async (_e, payload) => taskManager!.deleteGroup(payload.id));
  }

  // Stats handlers
  if (statsRepo) {
    ipcMain.handle(IPC.STATS_GET_DAILY, async (_e, payload) => {
      const stat = await statsRepo!.findByDate(payload.date);
      return stat ?? { date: payload.date, totalPomodoros: 0, completedTasks: 0, tasks: [] };
    });
    ipcMain.handle(IPC.STATS_GET_WEEKLY, async (_e, payload) => {
      const { computeWeeklyTrend } = await import('@pomodoro/core');
      const end = new Date(payload.endDate);
      const startDate = new Date(end);
      startDate.setDate(startDate.getDate() - 6);
      const allStats = await statsRepo!.findByDateRange(
        startDate.toISOString().slice(0, 10),
        payload.endDate,
      );
      return computeWeeklyTrend(allStats, payload.endDate);
    });
    ipcMain.handle(IPC.STATS_GET_MONTHLY, async () => {
      const { computeMonthlyStats } = await import('@pomodoro/core');
      const allStats = await statsRepo!.findByDateRange('2000-01-01', '2099-12-31');
      return computeMonthlyStats(allStats);
    });
  }

  // Settings handlers
  if (settingsRepo) {
    ipcMain.handle(IPC.SETTINGS_GET, async (_e, payload) => settingsRepo!.get(payload.key, payload.defaultValue));
    ipcMain.handle(IPC.SETTINGS_SET, async (_e, payload) => {
      const result = await settingsRepo!.set(payload.key, payload.value);
      // Update timer config when timer settings change
      if (['pomodoro_duration', 'short_break', 'long_break', 'long_break_interval'].includes(payload.key)) {
        await updateTimerConfig();
      }
      return result;
    });
    ipcMain.handle(IPC.SETTINGS_GET_ALL, async () => settingsRepo!.getAll());
    ipcMain.handle(IPC.SETTINGS_DELETE, async (_e, payload) => settingsRepo!.delete(payload.key));
  }

  // Data export/import handlers
  if (taskManager && statsRepo && settingsRepo) {
    ipcMain.handle(IPC.DATA_EXPORT, async () => {
      try {
        const tasks = await taskManager!.getAllTasks();
        const groups = await taskManager!.getAllGroups();
        const stats = await statsRepo!.findByDateRange('2000-01-01', '2099-12-31');
        const settingsData = await settingsRepo!.getAll();

        const exportData: ExportDataPayload = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          data: { tasks, groups, stats, settings: settingsData },
        };
        return exportData;
      } catch (error) {
        console.error('[DATA_EXPORT] Error:', error);
        throw error;
      }
    });

    ipcMain.handle(
      IPC.DATA_IMPORT,
      async (_e, payload: {
        data: { tasks: Task[]; groups: TaskGroup[]; stats: DailyStats[]; settings: Record<string, string> };
        mode: 'merge' | 'replace';
      }) => {
        try {
          // 后端验证 - 最后一道防线
          if (!payload.data || !Array.isArray(payload.data.tasks) || !Array.isArray(payload.data.groups)) {
            return { success: false, message: '无效数据格式：缺少任务或分组数据' };
          }

          const sqlite = getSqlite();

          // 使用事务确保原子性
          const importTransaction = sqlite.transaction(() => {
            if (payload.mode === 'replace') {
              clearAllData();
              // replace 模式：直接插入数据
              const groupStmt = sqlite.prepare(
                `INSERT INTO task_groups (id, name, color, task_order, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)`,
              );
              for (const group of payload.data.groups) {
                groupStmt.run(
                  group.id,
                  group.name,
                  group.color ?? null,
                  JSON.stringify(group.taskOrder ?? []),
                  group.createdAt,
                  group.updatedAt,
                );
              }

              const taskStmt = sqlite.prepare(
                `INSERT INTO tasks (id, title, description, notes, completed_pomodoros, status, group_id, last_pomodoro_time, tags, created_at, updated_at, completed_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              );
              for (const task of payload.data.tasks) {
                taskStmt.run(
                  task.id,
                  task.title,
                  task.description ?? null,
                  task.notes ?? '',
                  task.completedPomodoros ?? 0,
                  task.status,
                  task.groupId ?? null,
                  task.lastPomodoroTime ?? null,
                  JSON.stringify(task.tags ?? []),
                  task.createdAt,
                  task.updatedAt,
                  task.completedAt ?? null,
                );
              }
            } else {
              // merge 模式：使用 UPSERT 避免主键冲突
              const groupStmt = sqlite.prepare(
                `INSERT INTO task_groups (id, name, color, task_order, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     name = excluded.name,
                     color = excluded.color,
                     task_order = excluded.task_order,
                     updated_at = excluded.updated_at`,
              );
              for (const group of payload.data.groups) {
                groupStmt.run(
                  group.id,
                  group.name,
                  group.color ?? null,
                  JSON.stringify(group.taskOrder ?? []),
                  group.createdAt,
                  group.updatedAt,
                );
              }

              const taskStmt = sqlite.prepare(
                `INSERT INTO tasks (id, title, description, notes, completed_pomodoros, status, group_id, last_pomodoro_time, tags, created_at, updated_at, completed_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     title = excluded.title,
                     description = excluded.description,
                     notes = excluded.notes,
                     completed_pomodoros = excluded.completed_pomodoros,
                     status = excluded.status,
                     group_id = excluded.group_id,
                     last_pomodoro_time = excluded.last_pomodoro_time,
                     tags = excluded.tags,
                     updated_at = excluded.updated_at,
                     completed_at = excluded.completed_at`,
              );
              for (const task of payload.data.tasks) {
                taskStmt.run(
                  task.id,
                  task.title,
                  task.description ?? null,
                  task.notes ?? '',
                  task.completedPomodoros ?? 0,
                  task.status,
                  task.groupId ?? null,
                  task.lastPomodoroTime ?? null,
                  JSON.stringify(task.tags ?? []),
                  task.createdAt,
                  task.updatedAt,
                  task.completedAt ?? null,
                );
              }
            }

            // 导入统计 - 使用 UPSERT（两种模式相同）
            const statsStmt = sqlite.prepare(
              `INSERT INTO daily_stats (date, total_pomodoros, completed_tasks, tasks)
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT(date) DO UPDATE SET
                    total_pomodoros = ?,
                    completed_tasks = ?,
                    tasks = ?`,
            );
            for (const stat of payload.data.stats) {
              statsStmt.run(
                stat.date,
                stat.totalPomodoros,
                stat.completedTasks,
                JSON.stringify(stat.tasks),
                stat.totalPomodoros,
                stat.completedTasks,
                JSON.stringify(stat.tasks),
              );
            }

            // 导入设置 - 使用 UPSERT（两种模式相同）
            const settingsStmt = sqlite.prepare(
              `INSERT INTO settings (key, value) VALUES (?, ?)
                  ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            );
            for (const [key, value] of Object.entries(payload.data.settings)) {
              if (typeof value === 'string') {
                settingsStmt.run(key, value);
              }
            }
          });

          // 执行事务
          importTransaction();

          return { success: true, message: '导入成功' };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[DATA_IMPORT] Error:', error);
          return { success: false, message: errorMessage };
        }
      },
    );
  }
}
