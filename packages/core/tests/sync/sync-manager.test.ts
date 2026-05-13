import { describe, expect, jest, test } from '@jest/globals';
import { SyncManager } from '../../src/sync/sync-manager.js';

test('pullChanges creates a backup branch when git reports a conflict', async () => {
  const git = {
    pull: jest.fn<() => Promise<{ success: boolean; hasConflicts: boolean }>>().mockResolvedValue({ success: false, hasConflicts: true }),
    rebaseAbort: jest.fn<() => Promise<void>>(),
    createBranch: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    status: jest.fn<() => Promise<{ isClean: () => boolean; ahead: number; behind: number }>>().mockResolvedValue({ isClean: () => true, ahead: 0, behind: 0 }),
    hasChanges: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
    add: jest.fn(),
    commit: jest.fn(),
    fetch: jest.fn(),
    resetHard: jest.fn(),
    push: jest.fn(),
  } as any;

  jest.useFakeTimers({ now: new Date('2026-05-13T12:30:00Z') });
  const manager = new SyncManager(git, {} as any, { remoteName: 'origin', remoteBranch: 'main' });

  const result = await manager.pullChanges();

  expect(result.status).toBe('conflict');
  expect(result.conflictBranch).toMatch(/^local-backup-/);
  expect(git.rebaseAbort).toHaveBeenCalled();
  expect(git.createBranch).toHaveBeenCalled();
  jest.useRealTimers();
});
