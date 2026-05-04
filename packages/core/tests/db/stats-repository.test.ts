import { StatsRepository } from '../../src/db/stats-repository.js';
import { setupTestDb } from './helpers.js';
import { DailyStats } from '../../src/types/stats.js';

describe('StatsRepository', () => {
  let db: ReturnType<typeof setupTestDb>;
  let repo: StatsRepository;

  beforeEach(() => {
    db = setupTestDb();
    repo = new StatsRepository(db);
  });

  test('upsert creates a new stats row', async () => {
    const row = await repo.upsert('2026-05-04', { totalPomodoros: 4, completedTasks: 2, tasks: ['t1', 't2'] });
    expect(row.date).toBe('2026-05-04');
    expect(row.totalPomodoros).toBe(4);
    expect(row.completedTasks).toBe(2);
    expect(row.tasks).toEqual(['t1', 't2']);
  });

  test('upsert merges with existing row', async () => {
    await repo.upsert('2026-05-04', { totalPomodoros: 3, completedTasks: 1, tasks: ['t1'] });
    const row = await repo.upsert('2026-05-04', { totalPomodoros: 1, completedTasks: 1, tasks: ['t2'] });

    expect(row.totalPomodoros).toBe(4);
    expect(row.completedTasks).toBe(2);
    expect(row.tasks).toEqual(['t1', 't2']);
  });

  test('findByDate returns stats for a date', async () => {
    await repo.upsert('2026-05-04', { totalPomodoros: 5, completedTasks: 3, tasks: ['t1'] });
    const found = await repo.findByDate('2026-05-04');
    expect(found).not.toBeNull();
    expect(found!.totalPomodoros).toBe(5);
  });

  test('findByDate returns null for missing date', async () => {
    const found = await repo.findByDate('2026-12-25');
    expect(found).toBeNull();
  });

  test('findByDateRange returns stats within date range', async () => {
    await repo.upsert('2026-05-01', { totalPomodoros: 4, completedTasks: 2, tasks: ['t1'] });
    await repo.upsert('2026-05-03', { totalPomodoros: 6, completedTasks: 3, tasks: ['t2'] });
    await repo.upsert('2026-05-05', { totalPomodoros: 2, completedTasks: 1, tasks: ['t3'] });

    const range = await repo.findByDateRange('2026-05-01', '2026-05-04');
    expect(range).toHaveLength(2);
    expect(range[0].date).toBe('2026-05-01');
    expect(range[1].date).toBe('2026-05-03');
  });
});
