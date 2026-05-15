// packages/core/tests/storage/notes-storage.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { NotesStorage } from '../../src/storage/notes-storage.js';
import { FileStorage } from '../../src/storage/file-storage.js';

describe('NotesStorage', () => {
  let tempDir: string;
  let storage: FileStorage;
  let notes: NotesStorage;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tomato-test-'));
    storage = new FileStorage(tempDir);
    notes = new NotesStorage(storage);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('getNotes returns null when no notes file', async () => {
    const content = await notes.getNotes('task-123');
    expect(content).toBeNull();
  });

  test('saveNotes creates notes file', async () => {
    await notes.saveNotes('task-123', 'My notes');

    const content = await storage.readFile('notes/task-123.md');
    expect(content).toBe('My notes');
  });

  test('getNotes returns saved content', async () => {
    await notes.saveNotes('task-123', 'My notes');

    const content = await notes.getNotes('task-123');
    expect(content).toBe('My notes');
  });

  test('deleteNotes removes notes file', async () => {
    await notes.saveNotes('task-123', 'My notes');
    await notes.deleteNotes('task-123');

    const content = await notes.getNotes('task-123');
    expect(content).toBeNull();
  });

  test('saveNotes with empty content deletes file', async () => {
    await notes.saveNotes('task-123', 'My notes');
    await notes.saveNotes('task-123', '');

    const content = await notes.getNotes('task-123');
    expect(content).toBeNull();
  });
});
