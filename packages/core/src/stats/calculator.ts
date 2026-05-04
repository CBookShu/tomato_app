import { DailyStats, MonthlyStats } from '../types/stats.js';
import { getMonthKey } from '../utils/date-utils.js';

export function computeDailyStats(allStats: readonly DailyStats[], date: string): DailyStats {
  const found = allStats.find((s) => s.date === date);
  return found ?? { date, totalPomodoros: 0, completedTasks: 0, tasks: [] };
}

export function computeWeeklyTrend(
  allStats: readonly DailyStats[],
  endDate: string,
): DailyStats[] {
  const range: string[] = [];
  const endParts = endDate.split('-').map(Number);
  const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    range.push(`${yyyy}-${mm}-${dd}`);
  }

  return range.map((date) => computeDailyStats(allStats, date));
}

export function computeMonthlyStats(allStats: readonly DailyStats[]): MonthlyStats[] {
  const grouped = new Map<string, DailyStats[]>();

  for (const stat of allStats) {
    const monthKey = getMonthKey(stat.date);
    const existing = grouped.get(monthKey);
    if (existing) {
      existing.push(stat);
    } else {
      grouped.set(monthKey, [stat]);
    }
  }

  return [...grouped.entries()]
    .map(([month, dailyStats]) => ({
      month,
      dailyStats: dailyStats.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
