// packages/core/src/sync/sync-manager.ts
import { randomUUID } from 'node:crypto';
import { GitClient } from './git-client.js';
import { FileStorage } from '../storage/file-storage.js';
import { SyncResult, SyncStatus } from './types.js';

export class SyncManager {
  constructor(
    private git: GitClient,
    private storage: FileStorage,
    private options: { remoteName?: string; remoteBranch?: string } = {},
  ) {}

  private get remoteName(): string {
    return this.options.remoteName ?? 'origin';
  }

  private get remoteBranch(): string {
    return this.options.remoteBranch ?? 'main';
  }

  async commitChanges(message?: string): Promise<void> {
    if (!(await this.git.hasChanges())) {
      return;
    }

    await this.git.add('.');
    await this.git.commit(message || `sync: ${new Date().toISOString()}`);
  }

  async pullChanges(): Promise<SyncResult> {
    try {
      const result = await this.git.pull(true, this.remoteName, this.remoteBranch);

      if (result.hasConflicts) {
        // Abort rebase and create backup branch
        await this.git.rebaseAbort();
        const conflictBranch = await this.createBackupBranch();

        return {
          success: false,
          status: 'conflict',
          conflictBranch,
        };
      }

      return {
        success: true,
        status: 'synced',
      };
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: (error as Error).message,
      };
    }
  }

  async createBackupBranch(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const branchName = `local-backup-${timestamp}-${randomUUID().slice(0, 8)}`;
    await this.git.createBranch(branchName);
    return branchName;
  }

  async resetToRemote(): Promise<void> {
    await this.git.fetch(this.remoteName);
    await this.git.resetHard(`${this.remoteName}/${this.remoteBranch}`);
  }

  async pushChanges(): Promise<SyncResult> {
    try {
      const localBranch = await this.git.currentBranch();
      await this.git.push(this.remoteName, `${localBranch}:${this.remoteBranch}`);
      return {
        success: true,
        status: 'synced',
      };
    } catch (error) {
      const message = (error as Error).message;

      if (message.includes('non-fast-forward') || message.includes('behind')) {
        // Remote has new commits, need to pull first
        return {
          success: false,
          status: 'error',
          error: 'Remote has new commits. Pull first.',
        };
      }

      return {
        success: false,
        status: 'error',
        error: message,
      };
    }
  }

  async sync(): Promise<SyncResult> {
    // Commit any local changes
    await this.commitChanges('sync: local changes before pull');

    // Pull from remote
    const pullResult = await this.pullChanges();
    if (!pullResult.success) {
      return pullResult;
    }

    // Push the committed local state even if the working tree is clean.
    return this.pushChanges();
  }

  async resolveConflictAndSync(): Promise<SyncResult> {
    return this.sync();
  }

  async getStatus(): Promise<{ isClean: boolean; ahead: number; behind: number }> {
    const status = await this.git.status();
    return {
      isClean: status.isClean(),
      ahead: status.ahead,
      behind: status.behind,
    };
  }
}
