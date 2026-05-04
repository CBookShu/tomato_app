import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, gte, lte, and } from 'drizzle-orm';
import { dailyStats } from './schema.js';
import { DailyStats } from '../types/stats.js';

function rowToStats(row: typeof dailyStats.$inferSelect): DailyStats {
  return {
    date: row.date,
    totalPomodoros: row.totalPomodoros,
    completedTasks: row.completedTasks,
    tasks: JSON.parse(row.tasks),
  };
}

export class StatsRepository {
  constructor(private db: BetterSQLite3Database) {}

  async upsert(
    date: string,
    increment: { totalPomodoros?: number; completedTasks?: number; tasks?: string[] },
  ): Promise<DailyStats> {
    const existing = await this.findByDate(date);

    if (!existing) {
      const newRow = {
        date,
        totalPomodoros: increment.totalPomodoros ?? 0,
        completedTasks: increment.completedTasks ?? 0,
        tasks: JSON.stringify(increment.tasks ?? []),
      };
      await this.db.insert(dailyStats).values(newRow);
      return {
        date,
        totalPomodoros: newRow.totalPomodoros,
        completedTasks: newRow.completedTasks,
        tasks: increment.tasks ?? [],
      };
    }

    const newPomodoros = existing.totalPomodoros + (increment.totalPomodoros ?? 0);
    const newCompleted = existing.completedTasks + (increment.completedTasks ?? 0);
    const mergedTasks = [...new Set([...existing.tasks, ...(increment.tasks ?? [])])];

    await this.db
      .update(dailyStats)
      .set({
        totalPomodoros: newPomodoros,
        completedTasks: newCompleted,
        tasks: JSON.stringify(mergedTasks),
      })
      .where(eq(dailyStats.date, date));

    return { date, totalPomodoros: newPomodoros, completedTasks: newCompleted, tasks: mergedTasks };
  }

  async findByDate(date: string): Promise<DailyStats | null> {
    const rows = await this.db
      .select()
      .from(dailyStats)
      .where(eq(dailyStats.date, date))
      .all();
    return rows.length > 0 ? rowToStats(rows[0]) : null;
  }

  async findByDateRange(startDate: string, endDate: string): Promise<DailyStats[]> {
    const rows = await this.db
      .select()
      .from(dailyStats)
      .where(and(gte(dailyStats.date, startDate), lte(dailyStats.date, endDate)))
      .all();
    return rows.map(rowToStats);
  }
}
