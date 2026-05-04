import { computeDailyStats, computeWeeklyTrend, computeMonthlyStats } from '../../src/stats/calculator.js';
import { DailyStats } from '../../src/types/stats.js';

const sampleData: DailyStats[] = [
  { date: '2026-04-28', totalPomodoros: 4, completedTasks: 2, tasks: ['t1', 't2'] },
  { date: '2026-04-29', totalPomodoros: 6, completedTasks: 3, tasks: ['t3', 't4'] },
  { date: '2026-04-30', totalPomodoros: 0, completedTasks: 0, tasks: [] },
  { date: '2026-05-01', totalPomodoros: 8, completedTasks: 4, tasks: ['t5'] },
  { date: '2026-05-02', totalPomodoros: 3, completedTasks: 1, tasks: ['t6'] },
  { date: '2026-05-03', totalPomodoros: 5, completedTasks: 2, tasks: ['t7', 't8'] },
  { date: '2026-05-04', totalPomodoros: 7, completedTasks: 3, tasks: ['t9'] },
];

describe('computeDailyStats', () => {
  test('returns stats for a specific date', () => {
    const result = computeDailyStats(sampleData, '2026-05-01');
    expect(result).toEqual({ date: '2026-05-01', totalPomodoros: 8, completedTasks: 4, tasks: ['t5'] });
  });

  test('returns empty stats for a missing date', () => {
    const result = computeDailyStats(sampleData, '2026-05-10');
    expect(result).toEqual({ date: '2026-05-10', totalPomodoros: 0, completedTasks: 0, tasks: [] });
  });

  test('returns focus time in minutes', () => {
    const result = computeDailyStats(sampleData, '2026-05-01');
    expect(result.totalPomodoros).toBe(8);
  });
});

describe('computeWeeklyTrend', () => {
  test('returns last 7 days of stats in order', () => {
    const result = computeWeeklyTrend(sampleData, '2026-05-04');
    expect(result).toHaveLength(7);
    expect(result[0].date).toBe('2026-04-28');
    expect(result[6].date).toBe('2026-05-04');
  });

  test('fills missing dates with zero stats', () => {
    const sparse: DailyStats[] = [
      { date: '2026-05-01', totalPomodoros: 5, completedTasks: 2, tasks: ['t1'] },
      { date: '2026-05-04', totalPomodoros: 3, completedTasks: 1, tasks: ['t2'] },
    ];
    const result = computeWeeklyTrend(sparse, '2026-05-04');
    expect(result).toHaveLength(7);
    expect(result[2].date).toBe('2026-04-30');
    expect(result[2].totalPomodoros).toBe(0);
  });

  test('computes total pomodoros for the week', () => {
    const result = computeWeeklyTrend(sampleData, '2026-05-04');
    const total = result.reduce((sum, d) => sum + d.totalPomodoros, 0);
    expect(total).toBe(33);
  });

  test('returns zero-filled stats for dates with no data', () => {
    const sparse: DailyStats[] = [
      { date: '2026-05-01', totalPomodoros: 5, completedTasks: 2, tasks: ['t1'] },
    ];
    const result = computeWeeklyTrend(sparse, '2026-05-04');
    const missingDay = result.find((d) => d.date === '2026-05-03');
    expect(missingDay).toEqual({ date: '2026-05-03', totalPomodoros: 0, completedTasks: 0, tasks: [] });
  });
});

describe('computeMonthlyStats', () => {
  test('groups stats by month', () => {
    const result = computeMonthlyStats(sampleData);
    const months = result.map((m) => m.month);
    expect(months).toContain('2026-04');
    expect(months).toContain('2026-05');
  });

  test('each month has correct daily stats', () => {
    const result = computeMonthlyStats(sampleData);
    const april = result.find((m) => m.month === '2026-04')!;
    const may = result.find((m) => m.month === '2026-05')!;

    expect(april.dailyStats).toHaveLength(3);
    expect(may.dailyStats).toHaveLength(4);
  });
});
