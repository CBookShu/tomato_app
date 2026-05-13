import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import { PomodoroTimer, Task, TaskGroup, DailyStats, getToday } from '@pomodoro/core';
import type { TaskManager, IStatsRepository, ConfigFileRepository, AppConfig } from '@pomodoro/core';
import type { PomodoroConfig } from '@pomodoro/core';
import { updateTrayIcon, updateTrayTime, setTrayTaskTitle } from './tray.js';
import type { TimerStatus } from './tray.js';
import { clearAllData, getStorage } from './database.js';
import { safeSend } from './safe-send.js';
import { SyncService } from './sync/sync-service.js';

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

// Timer setting keys
const TIMER_SETTING_KEYS = ['pomodoroDuration', 'shortBreakDuration', 'longBreakDuration', 'longBreakInterval'] as const;
const BOOLEAN_SETTING_KEYS = ['autoStartBreak', 'autoStartPomodoro', 'soundEnabled', 'notificationEnabled'] as const;

let timer: PomodoroTimer | null = null;
let taskManager: TaskManager | null = null;
let statsRepo: IStatsRepository | null = null;
let configRepo: ConfigFileRepository | null = null;
let currentWindow: BrowserWindow | null = null;
let onPomodoroComplete: (() => void) | null = null;
let onBreakComplete: (() => void) | null = null;
let currentTimerStatus: TimerStatus = 'idle';
let currentRemainingTime: number = 0;

// Sync service instance
const syncService = new SyncService();

function parsePositiveIntOrNull(value: unknown): number | null {
  const parsed = typeof value === 'number'
    ? Math.floor(value)
    : parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function sanitizePositiveInt(value: unknown, fallback: number): number {
  return parsePositiveIntOrNull(value) ?? fallback;
}

async function getTimerConfig(): Promise<Partial<PomodoroConfig>> {
  // 测试环境优先使用环境变量
  if (process.env.NODE_ENV === 'test') {
    return {
      pomodoroDuration: sanitizePositiveInt(process.env.TEST_POMODORO_DURATION, 5),
      shortBreakDuration: sanitizePositiveInt(process.env.TEST_BREAK_DURATION, 3),
      longBreakDuration: sanitizePositiveInt(process.env.TEST_LONG_BREAK_DURATION, 5),
      longBreakInterval: sanitizePositiveInt(4, 4),
    };
  }

  // 生产环境从设置读取
  if (!configRepo) {
    return {};
  }

  const config = await configRepo.get();
  const pomodoroDuration = sanitizePositiveInt(config.pomodoroDuration, 25);
  const shortBreakDuration = sanitizePositiveInt(config.shortBreakDuration, 5);
  const longBreakDuration = sanitizePositiveInt(config.longBreakDuration, 15);
  const longBreakInterval = sanitizePositiveInt(config.longBreakInterval, 4);

  return {
    pomodoroDuration: pomodoroDuration * 60,
    shortBreakDuration: shortBreakDuration * 60,
    longBreakDuration: longBreakDuration * 60,
    longBreakInterval,
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
  _statsRepo?: IStatsRepository,
  _configRepo?: ConfigFileRepository,
  callbacks?: {
    onPomodoroComplete?: () => void;
    onBreakComplete?: () => void;
  },
) {
  taskManager = _taskManager ?? null;
  statsRepo = _statsRepo ?? null;
  configRepo = _configRepo ?? null;
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

  // Settings handlers (using ConfigFileRepository)
  if (configRepo) {
    ipcMain.handle(IPC.SETTINGS_GET, async (_e, payload) => {
      const config = await configRepo!.get();
      const key = payload.key as keyof AppConfig;
      if (payload.defaultValue !== undefined) {
        return (config[key] ?? payload.defaultValue) as string;
      }
      const value = config[key];
      return value !== undefined ? String(value) : undefined;
    });
    ipcMain.handle(IPC.SETTINGS_SET, async (_e, payload) => {
      const updates: Partial<AppConfig> = {};
      const key = payload.key as string;
      const value = payload.value as string;
      const isTimerSettingKey = TIMER_SETTING_KEYS.includes(key as typeof TIMER_SETTING_KEYS[number]);
      // Type conversion based on key
      if (isTimerSettingKey) {
        const parsedValue = parsePositiveIntOrNull(value);
        if (parsedValue === null) {
          return;
        }
        (updates as Record<string, number>)[key] = parsedValue;
      } else if (BOOLEAN_SETTING_KEYS.includes(key as typeof BOOLEAN_SETTING_KEYS[number])) {
        (updates as Record<string, boolean>)[key] = value === 'true';
      } else {
        (updates as Record<string, string>)[key] = value;
      }
      await configRepo!.update(updates);
      // Update timer config when timer settings change
      if (isTimerSettingKey) {
        await updateTimerConfig();
      }
    });
    ipcMain.handle(IPC.SETTINGS_GET_ALL, async () => {
      const config = await configRepo!.get();
      // Convert AppConfig to Record<string, string> for backwards compatibility
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(config)) {
        if (value !== undefined) {
          result[key] = String(value);
        }
      }
      return result;
    });
    ipcMain.handle(IPC.SETTINGS_DELETE, async (_e, payload) => {
      // Reset a setting to default by setting it to undefined
      const updates: Partial<AppConfig> = {};
      const key = payload.key as string;
      (updates as Record<string, undefined>)[key] = undefined;
      return configRepo!.update(updates);
    });
  }

  // Data export/import handlers
  if (taskManager && statsRepo && configRepo) {
    ipcMain.handle(IPC.DATA_EXPORT, async () => {
      try {
        const tasks = await taskManager!.getAllTasks();
        const groups = await taskManager!.getAllGroups();
        const stats = await statsRepo!.findByDateRange('2000-01-01', '2099-12-31');
        const config = await configRepo!.get();
        // Convert AppConfig to Record<string, string> for backwards compatibility
        const settingsData: Record<string, string> = {};
        for (const [key, value] of Object.entries(config)) {
          if (value !== undefined) {
            settingsData[key] = String(value);
          }
        }

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

          const storage = getStorage();

          if (payload.mode === 'replace') {
            // Clear all existing data first
            await clearAllData();
          }

          // Import groups using repository
          for (const group of payload.data.groups) {
            const existingGroup = await storage.groupRepo.findById(group.id);
            if (existingGroup && payload.mode === 'merge') {
              // Update existing group in merge mode
              await storage.groupRepo.update(group.id, group);
            } else {
              // Create new group (or replace mode)
              await storage.groupRepo.create(group);
            }
          }

          // Import tasks using repository
          for (const task of payload.data.tasks) {
            const existingTask = await storage.taskRepo.findById(task.id);
            if (existingTask && payload.mode === 'merge') {
              // Update existing task in merge mode
              await storage.taskRepo.update(task.id, task);
            } else {
              // Create new task (or replace mode)
              await storage.taskRepo.create(task);
            }
          }

          // Import stats using repository
          for (const stat of payload.data.stats) {
            await storage.statsRepo.save(stat);
          }

          // Import settings using config repository
          const configUpdates: Partial<AppConfig> = {};
          for (const [key, value] of Object.entries(payload.data.settings)) {
            if (typeof value === 'string') {
              // Type conversion based on key
              if (TIMER_SETTING_KEYS.includes(key as typeof TIMER_SETTING_KEYS[number])) {
                const parsedValue = parsePositiveIntOrNull(value);
                if (parsedValue !== null) {
                  (configUpdates as Record<string, number>)[key] = parsedValue;
                }
              } else if (BOOLEAN_SETTING_KEYS.includes(key as typeof BOOLEAN_SETTING_KEYS[number])) {
                (configUpdates as Record<string, boolean>)[key] = value === 'true';
              } else {
                (configUpdates as Record<string, string>)[key] = value;
              }
            }
          }
          await storage.configRepo.update(configUpdates);

          return { success: true, message: '导入成功' };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[DATA_IMPORT] Error:', error);
          return { success: false, message: errorMessage };
        }
      },
    );
  }

  // Sync handlers
  ipcMain.handle(IPC.SYNC_LOGIN, async () => {
    return syncService.login();
  });

  ipcMain.handle(IPC.SYNC_LOGOUT, async () => {
    return syncService.logout();
  });

  ipcMain.handle(IPC.SYNC_BIND_REPOSITORY, async (_event, payload: { repositoryUrl: string }) => {
    return syncService.bindRepository(payload.repositoryUrl);
  });

  ipcMain.handle(IPC.SYNC_UNBIND_REPOSITORY, async () => {
    return syncService.unbindRepository();
  });

  ipcMain.handle(IPC.SYNC_GET_STATUS, async () => {
    return syncService.getStatus();
  });

  ipcMain.handle(IPC.SYNC_SYNC, async () => {
    return syncService.sync();
  });

  ipcMain.handle(IPC.SYNC_RESOLVE_CONFLICT, async () => {
    return syncService.resolveConflict();
  });

  ipcMain.handle(IPC.SYNC_ROLLBACK, async () => {
    return syncService.rollback();
  });

  ipcMain.handle(IPC.SYNC_GET_DATA_DIR, async () => {
    return syncService.getDataDir();
  });

  if (process.env.NODE_ENV === 'test') {
    ipcMain.handle(IPC.TEST_SYNC_SEED, async (_event, payload: Parameters<SyncService['seedTestState']>[0]) => {
      await syncService.seedTestState(payload);
      return { success: true as const };
    });

    ipcMain.handle('test:fast-forward', async (_event, seconds: number) => {
      void seconds;
      const timerInstance = await getTimer();
      const state = timerInstance.getState();
      const storage = getStorage();
      if (state.status === 'working' && state.currentTaskId) {
        await storage.taskManager.incrementPomodoro(state.currentTaskId, getToday());
        timerInstance.stop();
      }
      return { success: true };
    });
  }
}
