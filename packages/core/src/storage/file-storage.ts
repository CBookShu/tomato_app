// packages/core/src/storage/file-storage.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export class FileStorage {
  constructor(private baseDir: string) {}

  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async readFile(relativePath: string): Promise<string | null> {
    const fullPath = path.join(this.baseDir, relativePath);
    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async fileExists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.baseDir, relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDir(relativePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    await fs.mkdir(fullPath, { recursive: true });
  }

  async listFiles(relativePath: string): Promise<string[]> {
    const fullPath = path.join(this.baseDir, relativePath);
    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    // Delete all subdirectories and their contents
    const subdirs = ['tasks', 'groups', 'stats', 'meta', 'tasks-notes'];
    for (const subdir of subdirs) {
      const fullPath = path.join(this.baseDir, subdir);
      try {
        await fs.rm(fullPath, { recursive: true, force: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }
}
