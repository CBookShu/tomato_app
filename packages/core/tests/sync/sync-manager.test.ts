import { describe, expect, jest, test } from '@jest/globals';
import { SyncManager } from '../../src/sync/sync-manager.js';

test('pullChanges uses merge and keeps the working tree for manual conflict resolution', async () => {
  const git = {
    pull: jest.fn(),
    fetch: jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    merge: jest.fn<(...args: unknown[]) => Promise<{ success: boolean; hasConflicts: boolean }>>().mockResolvedValue({ success: false, hasConflicts: true }),
    rebaseAbort: jest.fn<() => Promise<void>>(),
    createBranch: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    status: jest.fn<() => Promise<{ isClean: () => boolean; ahead: number; behind: number }>>().mockResolvedValue({ isClean: () => true, ahead: 0, behind: 0 }),
    hasChanges: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
    add: jest.fn(),
    commit: jest.fn(),
    resetHard: jest.fn(),
    currentBranch: jest.fn<() => Promise<string>>().mockResolvedValue('main'),
    push: jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
  } as any;

  jest.useFakeTimers({ now: new Date('2026-05-13T12:30:00Z') });
  const manager = new SyncManager(git, {} as any, { remoteName: 'origin', remoteBranch: 'main' });

  const result = await manager.pullChanges();

  expect(git.fetch).toHaveBeenCalledWith('origin');
  expect(git.merge).toHaveBeenCalledWith('origin/main');
  expect(result.status).toBe('conflict');
  expect(result.conflictBranch).toMatch(/^local-backup-/);
  expect(git.rebaseAbort).not.toHaveBeenCalled();
  expect(git.createBranch).toHaveBeenCalled();
  jest.useRealTimers();
});

test('pushChanges uses the configured remote and branch', async () => {
  const git = {
    pull: jest.fn(),
    rebaseAbort: jest.fn(),
    createBranch: jest.fn(),
    status: jest.fn<() => Promise<{ isClean: () => boolean; ahead: number; behind: number }>>().mockResolvedValue({ isClean: () => true, ahead: 0, behind: 0 }),
    hasChanges: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
    add: jest.fn(),
    commit: jest.fn(),
    resetHard: jest.fn(),
    currentBranch: jest.fn<() => Promise<string>>().mockResolvedValue('main'),
    push: jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
  } as any;

  const manager = new SyncManager(git, {} as any, { remoteName: 'upstream', remoteBranch: 'release' });

  await manager.pushChanges();

  expect(git.push).toHaveBeenCalledWith('upstream', 'main:release');
});

test('sync pushes committed local state after pull even when the working tree is clean', async () => {
  const git = {
    pull: jest.fn(),
    fetch: jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    merge: jest.fn<(...args: unknown[]) => Promise<{ success: boolean; hasConflicts: boolean }>>().mockResolvedValue({ success: true, hasConflicts: false }),
    rebaseAbort: jest.fn(),
    createBranch: jest.fn(),
    status: jest.fn<() => Promise<{ isClean: () => boolean; ahead: number; behind: number }>>().mockResolvedValue({ isClean: () => true, ahead: 0, behind: 0 }),
    hasChanges: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
    add: jest.fn(),
    commit: jest.fn(),
    resetHard: jest.fn(),
    currentBranch: jest.fn<() => Promise<string>>().mockResolvedValue('main'),
    push: jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
  } as any;

  const manager = new SyncManager(git, {} as any, { remoteName: 'origin', remoteBranch: 'main' });

  await manager.sync();

  expect(git.fetch).toHaveBeenCalledWith('origin');
  expect(git.merge).toHaveBeenCalledWith('origin/main');
  expect(git.push).toHaveBeenCalledWith('origin', 'main:main');
});

test('resolveConflictAndSync commits the resolved branch and pushes without pulling again', async () => {
  const git = {
    pull: jest.fn(),
    rebaseAbort: jest.fn(),
    createBranch: jest.fn(),
    status: jest.fn<() => Promise<{ isClean: () => boolean; ahead: number; behind: number }>>().mockResolvedValue({ isClean: () => false, ahead: 0, behind: 0 }),
    hasChanges: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    add: jest.fn(),
    commit: jest.fn(),
    fetch: jest.fn(),
    resetHard: jest.fn(),
    currentBranch: jest.fn<() => Promise<string>>().mockResolvedValue('local-backup-2026-05-13'),
    push: jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
  } as any;

  const manager = new SyncManager(git, {} as any, { remoteName: 'origin', remoteBranch: 'main' });

  await manager.resolveConflictAndSync();

  expect(git.add).toHaveBeenCalledWith('.');
  expect(git.commit).toHaveBeenCalledWith('sync: conflict resolution');
  expect(git.pull).not.toHaveBeenCalled();
  expect(git.push).toHaveBeenCalledWith('origin', 'local-backup-2026-05-13:main');
});
