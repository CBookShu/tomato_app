// packages/core/src/storage/stats-file-repo.ts
import { DailyStats } from '../types/stats.js';
import { FileStorage } from './file-storage.js';
import { getStatsPath } from './paths.js';
import { stringifyYaml, parseYaml } from './yaml-serializer.js';

interface StatsYaml {
  totalPomodoros: number;
  completedTasks: number;
  tasks: string[];
}

export interface IStatsRepository {
  findByDate(date: string): Promise<DailyStats | null>;
  findAll(): Promise<DailyStats[]>;
  upsert(date: string, increment: { totalPomodoros?: number; completedTasks?: number; tasks?: string[] }): Promise<DailyStats>;
}

export class StatsFileRepository implements IStatsRepository {
  constructor(private storage: FileStorage) {}

  async findByDate(date: string): Promise<DailyStats | null> {
    const content = await this.storage.readFile(getStatsPath('', date).replace(/^\//, ''));
    if (!content) return null;

    const yaml = parseYaml<StatsYaml>(content);
    return {
      date,
      totalPomodoros: yaml.totalPomodoros,
      completedTasks: yaml.completedTasks,
      tasks: yaml.tasks,
    };
  }

  async findAll(): Promise<DailyStats[]> {
    await this.storage.ensureDir('stats');
    const files = await this.storage.listFiles('stats');
    const stats: DailyStats[] = [];

    for (const file of files) {
      if (file.endsWith('.yaml')) {
        const date = file.replace('.yaml', '');
        const stat = await this.findByDate(date);
        if (stat) stats.push(stat);
      }
    }

    return stats;
  }

  async upsert(
    date: string,
    increment: { totalPomodoros?: number; completedTasks?: number; tasks?: string[] }
  ): Promise<DailyStats> {
    const existing = await this.findByDate(date);

    const stats: DailyStats = {
      date,
      totalPomodoros: (existing?.totalPomodoros ?? 0) + (increment.totalPomodoros ?? 0),
      completedTasks: (existing?.completedTasks ?? 0) + (increment.completedTasks ?? 0),
      tasks: [...new Set([...(existing?.tasks ?? []), ...(increment.tasks ?? [])])],
    };

    const yaml: StatsYaml = {
      totalPomodoros: stats.totalPomodoros,
      completedTasks: stats.completedTasks,
      tasks: stats.tasks as string[],
    };

    const content = stringifyYaml(yaml);
    await this.storage.writeFile(getStatsPath('', date).replace(/^\//, ''), content);

    return stats;
  }
}
