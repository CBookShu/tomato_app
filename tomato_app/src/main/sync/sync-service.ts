// tomato_app/src/main/sync/sync-service.ts
import { shell } from 'electron';
import { GitClient, SyncManager, SyncResult, FileStorage } from '@pomodoro/core';
import { OAuthServer, OAuthResult } from './oauth-server.js';
import { saveToken, getToken, deleteToken, hasToken } from './keychain.js';
import { getStorage } from '../database.js';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_REDIRECT_URI = 'http://localhost';

export class SyncService {
  private git: GitClient | null = null;
  private syncManager: SyncManager | null = null;

  async isLoggedIn(): Promise<boolean> {
    return hasToken();
  }

  async login(): Promise<boolean> {
    const oauthServer = new OAuthServer();
    const port = await oauthServer.start();

    const redirectUri = `${GITHUB_REDIRECT_URI}:${port}/callback`;
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`;

    await shell.openExternal(authUrl);

    try {
      const result: OAuthResult = await oauthServer.waitForCallback();
      await oauthServer.stop();

      if (result.error) {
        throw new Error(result.error);
      }

      // Exchange code for token
      const token = await this.exchangeCodeForToken(result.code, redirectUri);
      await saveToken(token);

      return true;
    } catch (error) {
      await oauthServer.stop();
      throw error;
    }
  }

  private async exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = (await response.json()) as { error?: string; error_description?: string; access_token?: string };
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    if (!data.access_token) {
      throw new Error('No access token received');
    }

    return data.access_token;
  }

  async logout(): Promise<void> {
    await deleteToken();
    this.git = null;
    this.syncManager = null;
  }

  async initGit(dataDir: string): Promise<void> {
    const token = await getToken();
    if (!token) {
      throw new Error('Not logged in');
    }

    const storage = getStorage().storage;
    this.git = new GitClient(dataDir);
    await this.git.init();
    this.syncManager = new SyncManager(this.git, storage);
  }

  async sync(): Promise<SyncResult> {
    if (!this.syncManager) {
      throw new Error('Sync not initialized');
    }
    return this.syncManager.sync();
  }

  async resolveConflict(): Promise<SyncResult> {
    if (!this.syncManager) {
      throw new Error('Sync not initialized');
    }
    return this.syncManager.resolveConflictAndSync();
  }

  async rollback(): Promise<void> {
    if (!this.syncManager) {
      throw new Error('Sync not initialized');
    }
    await this.syncManager.resetToRemote();
  }

  async getStatus(): Promise<{ isLoggedIn: boolean; syncStatus?: string }> {
    const loggedIn = await hasToken();
    if (!loggedIn) {
      return { isLoggedIn: false };
    }

    const status = this.syncManager ? await this.syncManager.getStatus() : { isClean: true, ahead: 0, behind: 0 };
    return {
      isLoggedIn: true,
      syncStatus: status.isClean ? 'synced' : 'pending',
    };
  }

  async getDataDir(): Promise<string> {
    return getStorage().dataDir;
  }
}
