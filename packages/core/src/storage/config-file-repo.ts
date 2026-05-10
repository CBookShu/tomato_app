// packages/core/src/storage/config-file-repo.ts
import { FileStorage } from './file-storage.js';
import { getConfigPath } from './paths.js';
import { stringifyYaml, parseYaml } from './yaml-serializer.js';

export interface AppConfig {
  pomodoroDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  soundEnabled: boolean;
  notificationEnabled: boolean;
  autoStartBreak?: boolean;
  autoStartPomodoro?: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  pomodoroDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  soundEnabled: true,
  notificationEnabled: true,
  autoStartBreak: false,
  autoStartPomodoro: false,
};

export class ConfigFileRepository {
  constructor(private storage: FileStorage) {}

  async get(): Promise<AppConfig> {
    const content = await this.storage.readFile(getConfigPath('').replace(/^\//, ''));
    if (!content) return { ...DEFAULT_CONFIG };

    const yaml = parseYaml<Partial<AppConfig>>(content);
    return { ...DEFAULT_CONFIG, ...yaml };
  }

  async set(updates: Partial<AppConfig>): Promise<AppConfig> {
    const existing = await this.get();
    const config: AppConfig = { ...existing, ...updates };

    const content = stringifyYaml(config);
    await this.storage.writeFile(getConfigPath('').replace(/^\//, ''), content);

    return config;
  }

  // Alias for compatibility
  async update(updates: Partial<AppConfig>): Promise<AppConfig> {
    return this.set(updates);
  }
}
