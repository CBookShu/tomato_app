import { describe, expect, test } from 'vitest';
import { normalizeTaskNotes, shouldAutoSaveNotes } from '../../src/renderer/lib/task-notes.js';

describe('task-notes', () => {
  test('normalizeTaskNotes converts empty task notes to empty string', () => {
    expect(normalizeTaskNotes(undefined)).toBe('');
    expect(normalizeTaskNotes(null)).toBe('');
  });

  test('shouldAutoSaveNotes skips when notes are unchanged', () => {
    expect(shouldAutoSaveNotes(true, 'hello', 'hello')).toBe(false);
  });

  test('shouldAutoSaveNotes runs when task exists and notes changed', () => {
    expect(shouldAutoSaveNotes(true, 'hello', 'hello world')).toBe(true);
  });

  test('shouldAutoSaveNotes waits until notes finish loading', () => {
    expect(shouldAutoSaveNotes(false, 'hello', 'hello world')).toBe(false);
  });
});
