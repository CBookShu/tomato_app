// packages/core/tests/storage/paths.test.ts
import { describe, test, expect } from '@jest/globals';
import { getStoragePaths, getTaskPath, getGroupPath, getStatsPath, getConfigPath, getNotesPath } from '../../src/storage/paths.js';

describe('Storage Paths', () => {
  const baseDir = '/tmp/tomato-data';

  test('getStoragePaths returns all paths', () => {
    const paths = getStoragePaths(baseDir);
    expect(paths.base).toBe(baseDir);
    expect(paths.meta).toBe(`${baseDir}/.meta`);
    expect(paths.groups).toBe(`${baseDir}/groups`);
    expect(paths.tasks).toBe(`${baseDir}/tasks`);
    expect(paths.notes).toBe(`${baseDir}/notes`);
    expect(paths.stats).toBe(`${baseDir}/stats`);
  });

  test('getTaskPath returns correct path', () => {
    expect(getTaskPath(baseDir, 'task-123')).toBe(`${baseDir}/tasks/task-123.yaml`);
  });

  test('getGroupPath returns correct path', () => {
    expect(getGroupPath(baseDir, 'group-456')).toBe(`${baseDir}/groups/group-456.yaml`);
  });

  test('getStatsPath returns correct path', () => {
    expect(getStatsPath(baseDir, '2026-05-10')).toBe(`${baseDir}/stats/2026-05-10.yaml`);
  });

  test('getConfigPath returns correct path', () => {
    expect(getConfigPath(baseDir)).toBe(`${baseDir}/.meta/config.yaml`);
  });

  test('getNotesPath returns correct path', () => {
    expect(getNotesPath(baseDir, 'task-123')).toBe(`${baseDir}/notes/task-123.md`);
  });
});
