import { PomodoroTimer } from '../../src/pomodoro/timer.js';
import { TimerState } from '../../src/types/timer.js';

describe('PomodoroTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('initial state is idle', () => {
    const timer = new PomodoroTimer();
    const state = timer.getState();
    expect(state.status).toBe('idle');
    expect(state.remainingTime).toBe(0);
    expect(state.currentCycle).toBe(0);
  });

  test('start transitions to working and emits statusChange', () => {
    const timer = new PomodoroTimer();
    const onStatusChange = jest.fn();
    timer.on('statusChange', onStatusChange);

    timer.start();

    const state = timer.getState();
    expect(state.status).toBe('working');
    expect(state.remainingTime).toBe(25 * 60);
    expect(onStatusChange).toHaveBeenCalledWith('working', 25 * 60);
  });

  test('tick emits every second with decrementing time', () => {
    const timer = new PomodoroTimer();
    const onTick = jest.fn();
    timer.on('tick', onTick);

    timer.start();

    jest.advanceTimersByTime(3000);
    expect(onTick).toHaveBeenCalledTimes(3);
    expect(onTick).toHaveBeenNthCalledWith(1, 25 * 60 - 1);
    expect(onTick).toHaveBeenNthCalledWith(2, 25 * 60 - 2);
    expect(onTick).toHaveBeenNthCalledWith(3, 25 * 60 - 3);
  });

  test('pause stops ticking and preserves time', () => {
    const timer = new PomodoroTimer();
    timer.start();
    jest.advanceTimersByTime(2000);

    timer.pause();

    const state = timer.getState();
    expect(state.status).toBe('paused');
    expect(state.remainingTime).toBe(25 * 60 - 2);
  });

  test('resume continues ticking from paused state', () => {
    const timer = new PomodoroTimer();
    timer.start();
    jest.advanceTimersByTime(1000);
    timer.pause();
    timer.resume();

    const onTick = jest.fn();
    timer.on('tick', onTick);

    jest.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalled();
    expect(timer.getState().status).toBe('working');
  });

  test('stop resets to idle', () => {
    const timer = new PomodoroTimer();
    timer.start();
    jest.advanceTimersByTime(5000);

    timer.stop();

    const state = timer.getState();
    expect(state.status).toBe('idle');
    expect(state.remainingTime).toBe(0);
  });

  test('complete event fires when timer reaches 0 in working state', () => {
    const timer = new PomodoroTimer();
    const onComplete = jest.fn();
    timer.on('complete', onComplete);

    timer.start();
    jest.advanceTimersByTime(25 * 60 * 1000 + 100);

    expect(onComplete).toHaveBeenCalledWith('work');
    expect(timer.getState().status).toBe('breaking');
  });

  test('complete event fires for break end and transitions to idle', () => {
    const timer = new PomodoroTimer();
    // Fast-forward through work + break
    timer.start();
    jest.advanceTimersByTime(25 * 60 * 1000); // work complete
    expect(timer.getState().status).toBe('breaking');

    const onComplete = jest.fn();
    timer.on('complete', onComplete);

    jest.advanceTimersByTime(5 * 60 * 1000 + 100); // break complete
    expect(onComplete).toHaveBeenCalledWith('break');
    expect(timer.getState().status).toBe('idle');
  });

  test('cycle increments each work session and resets after long break', () => {
    const timer = new PomodoroTimer({ longBreakInterval: 2 });

    // Cycle 1
    timer.start();
    jest.advanceTimersByTime(25 * 60 * 1000 + 100);
    expect(timer.getState().currentCycle).toBe(1);
    jest.advanceTimersByTime(5 * 60 * 1000 + 100);

    // Cycle 2 → should go to long-break
    timer.start();
    jest.advanceTimersByTime(25 * 60 * 1000 + 100);
    expect(timer.getState().currentCycle).toBe(2);
    expect(timer.getState().status).toBe('long-break');

    // Long break complete → cycle resets
    jest.advanceTimersByTime(15 * 60 * 1000 + 100);
    expect(timer.getState().currentCycle).toBe(0);
  });

  test('skip ends current work phase immediately', () => {
    const timer = new PomodoroTimer();
    timer.start();
    jest.advanceTimersByTime(5000);

    timer.skip();

    expect(timer.getState().status).toBe('breaking');
    expect(timer.getState().remainingTime).toBe(5 * 60);
  });

  test('skip during a long-break-due cycle emits complete and enters long-break', () => {
    const timer = new PomodoroTimer({ longBreakInterval: 2 });

    // Complete first cycle
    timer.start();
    jest.advanceTimersByTime(25 * 60 * 1000 + 100);
    jest.advanceTimersByTime(5 * 60 * 1000 + 100);

    // Start second cycle and skip
    timer.start();
    jest.advanceTimersByTime(5000);

    const onComplete = jest.fn();
    timer.on('complete', onComplete);

    timer.skip();

    expect(timer.getState().status).toBe('long-break');
    expect(onComplete).toHaveBeenCalledWith('work');
  });

  test('destroy cleans up the interval', () => {
    const timer = new PomodoroTimer();
    timer.start();
    const onTick = jest.fn();
    timer.on('tick', onTick);

    timer.destroy();
    jest.advanceTimersByTime(5000);

    expect(onTick).not.toHaveBeenCalled();
  });

  test('off removes an event listener', () => {
    const timer = new PomodoroTimer();
    const callback = jest.fn();
    timer.on('tick', callback);
    timer.off('tick', callback);

    timer.start();
    jest.advanceTimersByTime(2000);

    expect(callback).not.toHaveBeenCalled();
  });

  test('custom config overrides defaults', () => {
    const timer = new PomodoroTimer({ pomodoroDuration: 10 * 60 });
    timer.start();
    expect(timer.getState().remainingTime).toBe(10 * 60);
  });
});
