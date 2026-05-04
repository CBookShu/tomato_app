import { transition } from '../../src/pomodoro/state-machine.js';
import { DEFAULT_POMODORO_CONFIG, TimerState } from '../../src/types/timer.js';

const config = DEFAULT_POMODORO_CONFIG;
const idle: TimerState = { status: 'idle', remainingTime: 0, currentCycle: 0 };

describe('transition', () => {
  describe('from idle', () => {
    test('start transitions to working with full pomodoro time and increments cycle', () => {
      const result = transition(idle, 'start', config);
      expect(result.status).toBe('working');
      expect(result.remainingTime).toBe(config.pomodoroDuration);
      expect(result.currentCycle).toBe(1);
    });

    test('start with taskId stores the task id', () => {
      const result = transition(idle, 'start', config, 'task-1');
      expect(result.currentTaskId).toBe('task-1');
    });

    test('pause, resume, stop, tick-complete, skip are ignored from idle', () => {
      const ignoredEvents = ['pause', 'resume', 'stop', 'tick-complete', 'skip'] as const;
      for (const event of ignoredEvents) {
        const result = transition(idle, event, config);
        expect(result).toEqual(idle);
      }
    });
  });

  describe('from working', () => {
    const working: TimerState = { status: 'working', remainingTime: 1200, currentCycle: 2, currentTaskId: 't1' };

    test('pause transitions to paused, preserving remaining time and cycle', () => {
      const result = transition(working, 'pause', config);
      expect(result.status).toBe('paused');
      expect(result.remainingTime).toBe(1200);
      expect(result.currentCycle).toBe(2);
      expect(result.currentTaskId).toBe('t1');
    });

    test('stop transitions to idle, resetting state', () => {
      const result = transition(working, 'stop', config);
      expect(result.status).toBe('idle');
      expect(result.remainingTime).toBe(0);
      expect(result.currentTaskId).toBeUndefined();
    });

    test('tick-complete with cycle < longBreakInterval transitions to breaking', () => {
      const state: TimerState = { status: 'working', remainingTime: 0, currentCycle: 2 };
      const result = transition(state, 'tick-complete', config);
      expect(result.status).toBe('breaking');
      expect(result.remainingTime).toBe(config.shortBreakDuration);
      expect(result.currentCycle).toBe(2);
    });

    test('tick-complete with cycle >= longBreakInterval transitions to long-break', () => {
      const state: TimerState = { status: 'working', remainingTime: 0, currentCycle: 4 };
      const result = transition(state, 'tick-complete', config);
      expect(result.status).toBe('long-break');
      expect(result.remainingTime).toBe(config.longBreakDuration);
    });

    test('skip transitions to breaking when cycle < longBreakInterval', () => {
      const state: TimerState = { status: 'working', remainingTime: 500, currentCycle: 1 };
      const result = transition(state, 'skip', config);
      expect(result.status).toBe('breaking');
      expect(result.remainingTime).toBe(config.shortBreakDuration);
    });

    test('skip transitions to long-break when cycle >= longBreakInterval', () => {
      const state: TimerState = { status: 'working', remainingTime: 500, currentCycle: 4 };
      const result = transition(state, 'skip', config);
      expect(result.status).toBe('long-break');
      expect(result.remainingTime).toBe(config.longBreakDuration);
    });

    test('other events are ignored from working', () => {
      const state: TimerState = { status: 'working', remainingTime: 500, currentCycle: 1 };
      expect(transition(state, 'start', config)).toEqual(state);
      expect(transition(state, 'resume', config)).toEqual(state);
    });
  });

  describe('from paused', () => {
    const paused: TimerState = { status: 'paused', remainingTime: 800, currentCycle: 3, currentTaskId: 't2' };

    test('resume transitions back to working', () => {
      const result = transition(paused, 'resume', config);
      expect(result.status).toBe('working');
      expect(result.remainingTime).toBe(800);
      expect(result.currentCycle).toBe(3);
    });

    test('stop transitions to idle', () => {
      const result = transition(paused, 'stop', config);
      expect(result.status).toBe('idle');
      expect(result.remainingTime).toBe(0);
      expect(result.currentTaskId).toBeUndefined();
    });

    test('other events are ignored', () => {
      const result = transition(paused, 'start', config);
      expect(result).toEqual(paused);
    });
  });

  describe('from breaking', () => {
    const breaking: TimerState = { status: 'breaking', remainingTime: 120, currentCycle: 3 };

    test('tick-complete transitions to idle', () => {
      const result = transition(breaking, 'tick-complete', config);
      expect(result.status).toBe('idle');
      expect(result.remainingTime).toBe(0);
    });

    test('skip transitions to idle', () => {
      const result = transition(breaking, 'skip', config);
      expect(result.status).toBe('idle');
      expect(result.remainingTime).toBe(0);
    });

    test('other events are ignored from breaking', () => {
      const state: TimerState = { status: 'breaking', remainingTime: 120, currentCycle: 1 };
      expect(transition(state, 'start', config)).toEqual(state);
      expect(transition(state, 'pause', config)).toEqual(state);
      expect(transition(state, 'resume', config)).toEqual(state);
      expect(transition(state, 'stop', config)).toEqual(state);
    });
  });

  describe('from long-break', () => {
    const longBreak: TimerState = { status: 'long-break', remainingTime: 600, currentCycle: 4 };

    test('tick-complete transitions to idle and resets cycle to 0', () => {
      const result = transition(longBreak, 'tick-complete', config);
      expect(result.status).toBe('idle');
      expect(result.remainingTime).toBe(0);
      expect(result.currentCycle).toBe(0);
    });

    test('skip transitions to idle and resets cycle to 0', () => {
      const result = transition(longBreak, 'skip', config);
      expect(result.status).toBe('idle');
      expect(result.remainingTime).toBe(0);
      expect(result.currentCycle).toBe(0);
    });

    test('other events are ignored from long-break', () => {
      const state: TimerState = { status: 'long-break', remainingTime: 600, currentCycle: 4 };
      expect(transition(state, 'start', config)).toEqual(state);
      expect(transition(state, 'pause', config)).toEqual(state);
      expect(transition(state, 'resume', config)).toEqual(state);
      expect(transition(state, 'stop', config)).toEqual(state);
    });
  });

  describe('immutability', () => {
    test('does not mutate the original state', () => {
      const original: TimerState = { status: 'working', remainingTime: 500, currentCycle: 1 };
      const copy = { ...original };
      transition(original, 'pause', config);
      expect(original).toEqual(copy);
    });
  });
});
