// packages/core/src/storage/paths.ts
export interface StoragePaths {
  base: string;
  meta: string;
  entities: string;
  groups: string;
  tasks: string;
  tasksNotes: string;
  stats: string;
}

export function getStoragePaths(baseDir: string): StoragePaths {
  return {
    base: baseDir,
    meta: `${baseDir}/.meta`,
    entities: `${baseDir}/.meta/entities`,
    groups: `${baseDir}/.meta/entities/groups`,
    tasks: `${baseDir}/.meta/entities/tasks`,
    tasksNotes: `${baseDir}/tasks`,
    stats: `${baseDir}/stats`,
  };
}

export function getTaskPath(baseDir: string, taskId: string): string {
  return `${baseDir}/.meta/entities/tasks/${taskId}.yaml`;
}

export function getGroupPath(baseDir: string, groupId: string): string {
  return `${baseDir}/.meta/entities/groups/${groupId}.yaml`;
}

export function getStatsPath(baseDir: string, date: string): string {
  return `${baseDir}/stats/${date}.yaml`;
}

export function getConfigPath(baseDir: string): string {
  return `${baseDir}/.meta/config.yaml`;
}

export function getNotesPath(baseDir: string, taskId: string): string {
  return `${baseDir}/tasks/${taskId}.md`;
}
