import type { Task, TaskGroup, NewTask, NewTaskGroup, TaskStatus, SyncResult } from '@pomodoro/core';
import type { DailyStats, MonthlyStats, TimerState } from '@pomodoro/core';

// Data export/import types
export interface ExportData {
  version: string;
  exportedAt: string;
  data: {
    tasks: Task[];
    groups: TaskGroup[];
    stats: DailyStats[];
    settings: Record<string, string>;
  };
}

// Channel name constants
export const IPC = {
  // Timer
  TIMER_START: 'timer:start',
  TIMER_PAUSE: 'timer:pause',
  TIMER_RESUME: 'timer:resume',
  TIMER_STOP: 'timer:stop',
  TIMER_SKIP: 'timer:skip',
  TIMER_STATE: 'timer:state',
  TIMER_TICK: 'timer:tick',
  TIMER_STATUS_CHANGE: 'timer:statusChange',
  TIMER_COMPLETE: 'timer:complete',
  TIMER_TASK_TITLE: 'timer:taskTitle',

  // Tray actions
  TRAY_PAUSE: 'tray:pause',
  TRAY_STOP: 'tray:stop',
  TRAY_SKIP_BREAK: 'tray:skipBreak',

  // Tasks
  TASK_CREATE: 'task:create',
  TASK_GET: 'task:get',
  TASK_GET_ALL: 'task:getAll',
  TASK_GET_BY_STATUS: 'task:getByStatus',
  TASK_EDIT: 'task:edit',
  TASK_COMPLETE: 'task:complete',
  TASK_COMPLETE_EVENT: 'task:completeEvent',
  TASK_DELETE: 'task:delete',
  TASK_MOVE_TO_GROUP: 'task:moveToGroup',
  TASK_REORDER: 'task:reorder',
  TASK_INCREMENT_POMODORO: 'task:incrementPomodoro',

  // Groups
  GROUP_CREATE: 'group:create',
  GROUP_GET: 'group:get',
  GROUP_GET_ALL: 'group:getAll',
  GROUP_RENAME: 'group:rename',
  GROUP_DELETE: 'group:delete',

  // Stats
  STATS_GET_DAILY: 'stats:getDaily',
  STATS_GET_WEEKLY: 'stats:getWeekly',
  STATS_GET_MONTHLY: 'stats:getMonthly',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:getAll',
  SETTINGS_DELETE: 'settings:delete',

  // Data
  DATA_EXPORT: 'data:export',
  DATA_IMPORT: 'data:import',

  // Sound
  PLAY_SOUND: 'play-sound',

  // Sync
  SYNC_LOGIN: 'sync:login',
  SYNC_LOGOUT: 'sync:logout',
  SYNC_GET_STATUS: 'sync:get-status',
  SYNC_SYNC: 'sync:sync',
  SYNC_RESOLVE_CONFLICT: 'sync:resolve-conflict',
  SYNC_ROLLBACK: 'sync:rollback',
  SYNC_GET_DATA_DIR: 'sync:get-data-dir',
} as const;

// Request/Response type pairs for each channel
export interface IpcChannelMap {
  [IPC.TIMER_START]: { request: { taskId?: string }; response: void };
  [IPC.TIMER_PAUSE]: { request: void; response: void };
  [IPC.TIMER_RESUME]: { request: void; response: void };
  [IPC.TIMER_STOP]: { request: void; response: void };
  [IPC.TIMER_SKIP]: { request: void; response: void };
  [IPC.TIMER_STATE]: { request: void; response: TimerState };
  [IPC.TIMER_TASK_TITLE]: { request: string | null; response: void };

  [IPC.TASK_CREATE]: { request: { input: NewTask; referenceTaskId?: string; insertAfter?: boolean }; response: Task };
  [IPC.TASK_GET]: { request: { id: string }; response: Task | null };
  [IPC.TASK_GET_ALL]: { request: void; response: Task[] };
  [IPC.TASK_GET_BY_STATUS]: { request: { status: TaskStatus }; response: Task[] };
  [IPC.TASK_EDIT]: { request: { id: string; updates: Partial<Pick<Task, 'title' | 'description' | 'tags' | 'notes'>> }; response: Task };
  [IPC.TASK_COMPLETE]: { request: { id: string }; response: Task };
  [IPC.TASK_DELETE]: { request: { id: string }; response: void };
  [IPC.TASK_MOVE_TO_GROUP]: { request: { taskId: string; newGroupId: string }; response: Task };
  [IPC.TASK_REORDER]: { request: { taskId: string; newIndex: number }; response: void };
  [IPC.TASK_INCREMENT_POMODORO]: { request: { id: string; dateStr?: string }; response: Task };

  [IPC.GROUP_CREATE]: { request: { input: NewTaskGroup }; response: TaskGroup };
  [IPC.GROUP_GET]: { request: { id: string }; response: TaskGroup | null };
  [IPC.GROUP_GET_ALL]: { request: void; response: TaskGroup[] };
  [IPC.GROUP_RENAME]: { request: { id: string; name: string }; response: TaskGroup };
  [IPC.GROUP_DELETE]: { request: { id: string }; response: void };

  [IPC.STATS_GET_DAILY]: { request: { date: string }; response: DailyStats };
  [IPC.STATS_GET_WEEKLY]: { request: { endDate: string }; response: DailyStats[] };
  [IPC.STATS_GET_MONTHLY]: { request: void; response: MonthlyStats[] };

  [IPC.SETTINGS_GET]: { request: { key: string; defaultValue?: string }; response: string | null };
  [IPC.SETTINGS_SET]: { request: { key: string; value: string }; response: void };
  [IPC.SETTINGS_GET_ALL]: { request: void; response: Record<string, string> };
  [IPC.SETTINGS_DELETE]: { request: { key: string }; response: void };

  // Data export/import
  [IPC.DATA_EXPORT]: { request: void; response: ExportData };
  [IPC.DATA_IMPORT]: {
    request: { data: ExportData; mode: 'merge' | 'replace' };
    response: { success: boolean; message: string };
  };

  // Events from main -> renderer (no request)
  [IPC.TIMER_TICK]: { request: void; response: (remainingTime: number) => void };
  [IPC.TIMER_STATUS_CHANGE]: { request: void; response: (status: string, remainingTime: number, taskId?: string) => void };
  [IPC.TIMER_COMPLETE]: { request: void; response: (type: 'work' | 'break') => void };
  [IPC.TASK_COMPLETE_EVENT]: { request: void; response: (taskId: string) => void };
  [IPC.PLAY_SOUND]: { request: void; response: (soundType: string) => void };

  // Tray actions
  [IPC.TRAY_PAUSE]: { request: void; response: void };
  [IPC.TRAY_STOP]: { request: void; response: void };
  [IPC.TRAY_SKIP_BREAK]: { request: void; response: void };

  // Sync
  [IPC.SYNC_LOGIN]: { request: void; response: boolean };
  [IPC.SYNC_LOGOUT]: { request: void; response: void };
  [IPC.SYNC_GET_STATUS]: { request: void; response: { isLoggedIn: boolean; syncStatus?: string } };
  [IPC.SYNC_SYNC]: { request: void; response: SyncResult };
  [IPC.SYNC_RESOLVE_CONFLICT]: { request: void; response: SyncResult };
  [IPC.SYNC_ROLLBACK]: { request: void; response: void };
  [IPC.SYNC_GET_DATA_DIR]: { request: void; response: string };
}

export type IpcEventChannel =
  | typeof IPC.TIMER_TICK
  | typeof IPC.TIMER_STATUS_CHANGE
  | typeof IPC.TIMER_COMPLETE
  | typeof IPC.TASK_COMPLETE_EVENT
  | typeof IPC.PLAY_SOUND;

declare global {
  interface Window {
    electronAPI: {
      invoke<C extends keyof IpcChannelMap>(
        channel: C,
        ...args: IpcChannelMap[C]['request'] extends void ? [] : [IpcChannelMap[C]['request']]
      ): Promise<IpcChannelMap[C]['response']>;
      on(channel: IpcEventChannel, callback: (...args: unknown[]) => void): () => void;
      sync: {
        login: () => Promise<boolean>;
        logout: () => Promise<void>;
        getStatus: () => Promise<{ isLoggedIn: boolean; syncStatus?: string }>;
        sync: () => Promise<SyncResult>;
        resolveConflict: () => Promise<SyncResult>;
        rollback: () => Promise<void>;
        getDataDir: () => Promise<string>;
      };
    };
  }
}
