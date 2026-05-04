import { create } from 'zustand';
import type { DailyStats, MonthlyStats } from '@pomodoro/core';

interface StatsStoreState {
  today: DailyStats | null;
  weekly: DailyStats[];
  monthly: MonthlyStats[];
  loading: boolean;

  setToday: (stats: DailyStats) => void;
  setWeekly: (stats: DailyStats[]) => void;
  setMonthly: (stats: MonthlyStats[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useStatsStore = create<StatsStoreState>((set) => ({
  today: null,
  weekly: [],
  monthly: [],
  loading: false,

  setToday: (today) => set({ today }),
  setWeekly: (weekly) => set({ weekly }),
  setMonthly: (monthly) => set({ monthly }),
  setLoading: (loading) => set({ loading }),
}));
