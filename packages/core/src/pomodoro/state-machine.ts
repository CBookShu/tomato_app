import { TimerState, TimerEvent, PomodoroConfig } from '../types/timer.js';

const IGNORED_IN_IDLE: TimerEvent[] = ['pause', 'resume', 'stop', 'tick-complete', 'skip'];
const IGNORED_IN_PAUSED: TimerEvent[] = ['start', 'pause', 'tick-complete', 'skip'];

export function transition(
  state: TimerState,
  event: TimerEvent,
  config: PomodoroConfig,
  taskId?: string,
): TimerState {
  const { status, currentCycle } = state;

  switch (status) {
    case 'idle': {
      if (event === 'start') {
        return {
          status: 'working',
          remainingTime: config.pomodoroDuration,
          currentCycle: currentCycle + 1,
          currentTaskId: taskId,
        };
      }
      if (IGNORED_IN_IDLE.includes(event)) return state;
      return state;
    }

    case 'working': {
      if (event === 'pause') {
        return { ...state, status: 'paused' };
      }
      if (event === 'stop') {
        return { status: 'idle', remainingTime: 0, currentCycle };
      }
      if (event === 'tick-complete' || event === 'skip') {
        const isLongBreak = currentCycle >= config.longBreakInterval;
        return {
          status: isLongBreak ? 'long-break' : 'breaking',
          remainingTime: isLongBreak ? config.longBreakDuration : config.shortBreakDuration,
          currentCycle,
          currentTaskId: state.currentTaskId,
        };
      }
      return state;
    }

    case 'paused': {
      if (event === 'resume') {
        return { ...state, status: 'working' };
      }
      if (event === 'stop') {
        return { status: 'idle', remainingTime: 0, currentCycle };
      }
      if (IGNORED_IN_PAUSED.includes(event)) return state;
      return state;
    }

    case 'breaking': {
      if (event === 'tick-complete' || event === 'skip') {
        return {
          status: 'idle',
          remainingTime: 0,
          currentCycle,
          currentTaskId: state.currentTaskId,
        };
      }
      return state;
    }

    case 'long-break': {
      if (event === 'tick-complete' || event === 'skip') {
        return {
          status: 'idle',
          remainingTime: 0,
          currentCycle: 0,
          currentTaskId: state.currentTaskId,
        };
      }
      return state;
    }

    default:
      return state;
  }
}
