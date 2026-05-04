import { create } from 'zustand';
import type { TimerStatus, TimerState } from '@pomodoro/core';

interface TimerStoreState {
  status: TimerStatus;
  remainingTime: number;
  currentCycle: number;
  currentTaskId?: string;

  setState: (state: TimerState) => void;
  tick: (remainingTime: number) => void;
  formattedTime: () => string;
}

export const useTimerStore = create<TimerStoreState>((set, get) => ({
  status: 'idle',
  remainingTime: 0,
  currentCycle: 0,
  currentTaskId: undefined,

  setState: (timerState) =>
    set({
      status: timerState.status,
      remainingTime: timerState.remainingTime,
      currentCycle: timerState.currentCycle,
      currentTaskId: timerState.currentTaskId,
    }),

  tick: (remainingTime) => set({ remainingTime }),

  formattedTime: () => {
    const t = get().remainingTime;
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },
}));
