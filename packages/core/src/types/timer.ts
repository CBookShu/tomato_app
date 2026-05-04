export type TimerStatus = 'idle' | 'working' | 'paused' | 'breaking' | 'long-break';

export type TimerEvent = 'start' | 'pause' | 'resume' | 'stop' | 'tick-complete' | 'skip';

export interface TimerState {
  readonly status: TimerStatus;
  readonly remainingTime: number;
  readonly currentCycle: number;
  readonly currentTaskId?: string;
}

export interface PomodoroConfig {
  readonly pomodoroDuration: number;
  readonly shortBreakDuration: number;
  readonly longBreakDuration: number;
  readonly longBreakInterval: number;
}

export const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  pomodoroDuration: 25 * 60,
  shortBreakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  longBreakInterval: 4,
};
