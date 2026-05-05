import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import { PomodoroTimer } from '@pomodoro/core';
import type { TaskManager, StatsRepository, SettingsRepository } from '@pomodoro/core';
import type { PomodoroConfig } from '@pomodoro/core';

let timer: PomodoroTimer | null = null;
let taskManager: TaskManager | null = null;
let statsRepo: StatsRepository | null = null;
let settingsRepo: SettingsRepository | null = null;
let currentWindow: BrowserWindow | null = null;

async function getTimerConfig(): Promise<Partial<PomodoroConfig>> {
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
  t.on('tick', (remainingTime: number) => win?.webContents.send(IPC.TIMER_TICK, remainingTime));
  t.on('statusChange', (status: string) => win?.webContents.send(IPC.TIMER_STATUS_CHANGE, status));
  t.on('complete', (type: 'work' | 'break') => win?.webContents.send(IPC.TIMER_COMPLETE, type));
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
) {
  taskManager = _taskManager ?? null;
  statsRepo = _statsRepo ?? null;
  settingsRepo = _settingsRepo ?? null;

  // Timer handlers
  ipcMain.handle(IPC.TIMER_START, async (_event, payload?: { taskId?: string }) => {
    currentWindow = getWindow();
    const t = await getTimer();
    t.start(payload?.taskId);
  });

  ipcMain.handle(IPC.TIMER_PAUSE, async () => (await getTimer()).pause());
  ipcMain.handle(IPC.TIMER_RESUME, async () => (await getTimer()).resume());
  ipcMain.handle(IPC.TIMER_STOP, async () => (await getTimer()).stop());
  ipcMain.handle(IPC.TIMER_SKIP, async () => (await getTimer()).skip());
  ipcMain.handle(IPC.TIMER_STATE, async () => (await getTimer()).getState());

  // Task handlers (only if taskManager injected)
  if (taskManager) {
    ipcMain.handle(IPC.TASK_CREATE, async (_e, payload) => {
      return taskManager!.createTask(payload.input, payload.referenceTaskId, payload.insertAfter);
    });
    ipcMain.handle(IPC.TASK_GET, async (_e, payload) => taskManager!.getTask(payload.id));
    ipcMain.handle(IPC.TASK_GET_ALL, async () => taskManager!.getAllTasks());
    ipcMain.handle(IPC.TASK_GET_BY_STATUS, async (_e, payload) => taskManager!.getTasksByStatus(payload.status));
    ipcMain.handle(IPC.TASK_EDIT, async (_e, payload) => taskManager!.editTask(payload.id, payload.updates));
    ipcMain.handle(IPC.TASK_COMPLETE, async (_e, payload) => taskManager!.completeTask(payload.id));
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
}
