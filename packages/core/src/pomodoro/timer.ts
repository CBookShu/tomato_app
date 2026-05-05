import { TimerState, TimerStatus, PomodoroConfig, DEFAULT_POMODORO_CONFIG } from '../types/timer.js';
import { transition } from './state-machine.js';

interface TimerEventPayload {
  tick: [remainingTime: number];
  statusChange: [status: TimerStatus, remainingTime: number];
  complete: [completionType: 'work' | 'break'];
}

type EventName = keyof TimerEventPayload;

export class PomodoroTimer {
  private state: TimerState;
  private config: PomodoroConfig;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners = new Map<EventName, Set<(...args: any[]) => void>>();

  constructor(config?: Partial<PomodoroConfig>) {
    this.config = { ...DEFAULT_POMODORO_CONFIG, ...config };
    this.state = { status: 'idle', remainingTime: 0, currentCycle: 0 };
  }

  start(taskId?: string): void {
    this.setState(transition(this.state, 'start', this.config, taskId));
    this.startTimer();
  }

  pause(): void {
    this.clearTimer();
    this.setState(transition(this.state, 'pause', this.config));
  }

  resume(): void {
    this.setState(transition(this.state, 'resume', this.config));
    this.startTimer();
  }

  stop(): void {
    this.clearTimer();
    this.setState(transition(this.state, 'stop', this.config));
  }

  skip(): void {
    this.clearTimer();
    const newState = transition(this.state, 'skip', this.config);
    this.setState(newState);
    if (newState.status === 'breaking' || newState.status === 'long-break') {
      this.emit('complete', 'work');
      this.startTimer();
    }
  }

  getState(): Readonly<TimerState> {
    return this.state;
  }

  on<E extends EventName>(event: E, callback: (...args: TimerEventPayload[E]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as (...args: any[]) => void);
  }

  off<E extends EventName>(event: E, callback: (...args: TimerEventPayload[E]) => void): void {
    this.listeners.get(event)?.delete(callback as (...args: any[]) => void);
  }

  destroy(): void {
    this.clearTimer();
    this.listeners.clear();
  }

  private tick(): void {
    const newTime = this.state.remainingTime - 1;
    if (newTime <= 0) {
      this.clearTimer();
      const completionType: 'work' | 'break' =
        this.state.status === 'working' ? 'work' : 'break';
      const newState = transition(
        { ...this.state, remainingTime: 0 },
        'tick-complete',
        this.config,
      );
      this.setState(newState);
      this.emit('complete', completionType);
      if (newState.status === 'breaking' || newState.status === 'long-break') {
        this.startTimer();
      }
    } else {
      this.setState({ ...this.state, remainingTime: newTime });
      this.emit('tick', newTime);
    }
  }

  private startTimer(): void {
    this.clearTimer();
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  private clearTimer(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private setState(newState: TimerState): void {
    const oldStatus = this.state.status;
    this.state = newState;
    if (newState.status !== oldStatus) {
      this.emit('statusChange', newState.status, newState.remainingTime);
    }
  }

  private emit<E extends EventName>(event: E, ...args: TimerEventPayload[E]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }
}
