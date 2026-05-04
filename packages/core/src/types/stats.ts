export interface DailyStats {
  readonly date: string;
  readonly totalPomodoros: number;
  readonly completedTasks: number;
  readonly tasks: readonly string[];
}

export interface MonthlyStats {
  readonly month: string;
  readonly dailyStats: readonly DailyStats[];
}
