// packages/core/src/storage/notes-storage.ts
import { FileStorage } from './file-storage.js';
import { getNotesPath } from './paths.js';

export class NotesStorage {
  constructor(private storage: FileStorage) {}

  async getNotes(taskId: string): Promise<string | null> {
    return this.storage.readFile(getNotesPath('', taskId).replace(/^\//, ''));
  }

  async saveNotes(taskId: string, content: string): Promise<void> {
    const path = getNotesPath('', taskId).replace(/^\//, '');

    if (!content.trim()) {
      await this.storage.deleteFile(path);
    } else {
      await this.storage.writeFile(path, content);
    }
  }

  async deleteNotes(taskId: string): Promise<void> {
    await this.storage.deleteFile(getNotesPath('', taskId).replace(/^\//, ''));
  }
}
