import { app } from 'electron';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { UpdateSnapshot } from '../../shared/app-update.js';

export function getUpdateCachePath(baseDir: string = path.join(app.getPath('userData'), 'tomato-data')): string {
  return path.join(baseDir, 'update-cache.json');
}

export class UpdateCache {
  constructor(private readonly baseDir: string = path.join(app.getPath('userData'), 'tomato-data')) {}

  async load(): Promise<UpdateSnapshot | null> {
    try {
      const raw = await readFile(getUpdateCachePath(this.baseDir), 'utf8');
      return JSON.parse(raw) as UpdateSnapshot;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async save(snapshot: UpdateSnapshot): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    await writeFile(getUpdateCachePath(this.baseDir), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }

  async clear(): Promise<void> {
    await rm(getUpdateCachePath(this.baseDir), { force: true });
  }
}
