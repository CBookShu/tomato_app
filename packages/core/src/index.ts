// Types
export type { TimerStatus, TimerEvent, TimerState, PomodoroConfig } from './types/timer.js';
export { DEFAULT_POMODORO_CONFIG } from './types/timer.js';
export type { TaskStatus, Task, TaskGroup, NewTask, NewTaskGroup } from './types/task.js';
export { DEFAULT_GROUP_ID } from './types/task.js';
export type { DailyStats, MonthlyStats } from './types/stats.js';

// Pomodoro
export { transition } from './pomodoro/state-machine.js';
export { PomodoroTimer } from './pomodoro/timer.js';

// Tasks
export { addTaskAtPosition, reorderTasks, removeTaskFromOrder } from './tasks/sorting.js';
export { TaskManager } from './tasks/task-manager.js';
export type { ITaskRepository, ITaskGroupRepository } from './tasks/task-manager.js';

// Stats
export { computeDailyStats, computeWeeklyTrend, computeMonthlyStats } from './stats/calculator.js';

// Utils
export { generateId } from './utils/id-generator.js';
export { getToday, getWeekRange, getMonthKey } from './utils/date-utils.js';

// Database
export { getDb, closeDb } from './db/connection.js';
export { TaskRepository } from './db/task-repository.js';
export { TaskGroupRepository } from './db/task-group-repository.js';
export { StatsRepository } from './db/stats-repository.js';
export { SettingsRepository } from './db/settings-repository.js';
export * from './db/schema.js';
