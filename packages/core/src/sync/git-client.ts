// packages/core/src/sync/git-client.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import simpleGit, { SimpleGit, StatusResult } from 'simple-git';

export interface GitClientOptions {
  remoteName?: string;
  remoteBranch?: string;
  env?: NodeJS.ProcessEnv;
}

export class GitClient {
  private git: SimpleGit;
  private remoteName: string;
  private remoteBranch: string;

  constructor(private baseDir: string, private options: GitClientOptions = {}) {
    this.remoteName = options.remoteName ?? 'origin';
    this.remoteBranch = options.remoteBranch ?? 'main';
    this.git = simpleGit({ baseDir }).env(options.env ?? {});
  }

  async init(): Promise<void> {
    const gitDir = path.join(this.baseDir, '.git');
    try {
      await fs.access(gitDir);
    } catch {
      await this.git.init();
      await this.git.addConfig('user.name', 'Tomato App');
      await this.git.addConfig('user.email', 'tomato@app.local');
    }
  }

  async isRepo(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  async add(files: string): Promise<void> {
    await this.git.add(files);
  }

  async commit(message: string): Promise<void> {
    await this.git.commit(message);
  }

  async status(): Promise<StatusResult> {
    return this.git.status();
  }

  async hasChanges(): Promise<boolean> {
    const status = await this.status();
    return !status.isClean();
  }

  async createBranch(name: string): Promise<void> {
    await this.git.branch([name]);
  }

  async checkout(branch: string): Promise<void> {
    await this.git.checkout(branch);
  }

  async currentBranch(): Promise<string> {
    const status = await this.status();
    return status.current || 'main';
  }

  async listBranches(): Promise<string[]> {
    const result = await this.git.branchLocal();
    return result.all;
  }

  async deleteBranch(name: string): Promise<void> {
    await this.git.deleteLocalBranch(name);
  }

  async fetch(remote: string = 'origin'): Promise<void> {
    await this.git.fetch(remote);
  }

  async getRemoteDefaultBranch(remote: string = this.remoteName): Promise<string | null> {
    const output = await this.git.raw(['ls-remote', '--symref', remote, 'HEAD']);
    const match = output.match(/^ref:\s+refs\/heads\/([^\s]+)\s+HEAD/m);
    return match?.[1] ?? null;
  }

  async pull(rebase: boolean = true): Promise<{ success: boolean; hasConflicts: boolean }> {
    try {
      if (rebase) {
        await this.git.pull(this.remoteName, this.remoteBranch, ['--rebase']);
      } else {
        await this.git.pull(this.remoteName, this.remoteBranch);
      }
      return { success: true, hasConflicts: false };
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('conflict') || message.includes('CONFLICT')) {
        return { success: false, hasConflicts: true };
      }
      throw error;
    }
  }

  async push(remote: string = this.remoteName): Promise<void> {
    await this.git.push(remote, this.remoteBranch);
  }

  async rebaseAbort(): Promise<void> {
    await this.git.rebase(['--abort']);
  }

  async resetHard(ref: string): Promise<void> {
    await this.git.reset(['--hard', ref]);
  }

  async merge(branch: string): Promise<{ success: boolean; hasConflicts: boolean }> {
    try {
      await this.git.merge([branch]);
      return { success: true, hasConflicts: false };
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('conflict') || message.includes('CONFLICT')) {
        return { success: false, hasConflicts: true };
      }
      throw error;
    }
  }

  async log(maxCount: number = 10): Promise<{ latest?: { message: string; hash: string } }> {
    try {
      const result = await this.git.log({ maxCount });
      if (result.latest) {
        return {
          latest: {
            message: result.latest.message,
            hash: result.latest.hash,
          },
        };
      }
      return {};
    } catch {
      // No commits yet or other error
      return {};
    }
  }

  async addRemote(name: string, url: string): Promise<void> {
    try {
      await this.git.addRemote(name, url);
    } catch {
      // Remote already exists
    }
  }

  async getRemoteUrl(name: string = 'origin'): Promise<string | null> {
    try {
      const remotes = await this.git.getRemotes(true);
      const remote = remotes.find((r) => r.name === name);
      return remote?.refs?.fetch || null;
    } catch {
      return null;
    }
  }
}
