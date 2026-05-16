import { useStatsStore } from '@/stores/stats-store.js';
import { useIpc } from './useIpc.js';
import { IPC } from '@shared/ipc-channels.js';

export function useStatsRefresh() {
  const { invoke } = useIpc();
  const statsStore = useStatsStore();

  return async () => {
    const { getToday } = await import('@pomodoro/core/dist/utils/date-utils.js');
    const today = getToday();
    const [todayStats, weeklyStats = []] = await Promise.all([
      invoke(IPC.STATS_GET_DAILY, { date: today }),
      invoke(IPC.STATS_GET_WEEKLY, { endDate: today }),
    ]);

    statsStore.setToday(todayStats);
    statsStore.setWeekly(weeklyStats);
  };
}
