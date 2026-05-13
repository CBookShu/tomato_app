import { shell } from 'electron';
import type { FileStorage, SyncResult, SyncStatus } from '@pomodoro/core';
import { GitClient, SyncManager } from '@pomodoro/core';
import { getStorage } from '../database.js';
import { OAuthServer, type OAuthResult } from './oauth-server.js';
import { createGitCredentialEnv } from './git-credentials.js';
import {
  createRepositoryBinding,
  parseGitHubRepositoryUrl,
  RepositoryBindingStore,
  type RepositoryBinding,
} from './repository-binding.js';
import { deleteToken, getToken, hasToken, saveToken } from './keychain.js';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_REDIRECT_URI = 'http://localhost';
const DEFAULT_REMOTE_NAME: 'origin' = 'origin';
const DEFAULT_REMOTE_BRANCH = 'main';

interface TokenStore {
  getToken: () => Promise<string | null>;
  saveToken: (token: string) => Promise<void>;
  deleteToken: () => Promise<void>;
  hasToken: () => Promise<boolean>;
}

interface BindingStore {
  loadBinding: () => Promise<RepositoryBinding | null>;
  saveBinding: (binding: RepositoryBinding) => Promise<void>;
  clearBinding: () => Promise<void>;
}

interface SyncServiceDeps {
  bindingStore?: BindingStore;
  tokenStore?: TokenStore;
  gitFactory?: (dataDir: string, options: { remoteName?: string; remoteBranch?: string; env?: NodeJS.ProcessEnv }) => GitClient;
  syncManagerFactory?: (git: GitClient, storage: FileStorage, options: { remoteName: string; remoteBranch: string }) => SyncManager;
  openExternal?: typeof shell.openExternal;
  oauthServerFactory?: () => OAuthServer;
  dataDirProvider?: () => string;
  storage?: FileStorage;
}

type GitClientWithRemoteDefaultBranch = GitClient & {
  getRemoteDefaultBranch: (remote?: string) => Promise<string | null>;
};

export interface SyncServiceStatus {
  isLoggedIn: boolean;
  isBound: boolean;
  repositoryUrl: string | null;
  repositoryOwner: string | null;
  repositoryName: string | null;
  remoteName: string | null;
  remoteBranch: string | null;
  boundAt: string | null;
  updatedAt: string | null;
  syncStatus: SyncStatus;
  lastSyncTime: string | null;
  error: string | null;
  conflictBranch: string | null;
}

const defaultBindingStore = new RepositoryBindingStore();
const defaultTokenStore: TokenStore = {
  getToken,
  saveToken,
  deleteToken,
  hasToken,
};

export class SyncService {
  private git: GitClient | null = null;
  private syncManager: SyncManager | null = null;
  private binding: RepositoryBinding | null = null;
  private syncStatus: SyncStatus = 'idle';
  private lastSyncTime: string | null = null;
  private lastError: string | null = null;
  private conflictBranch: string | null = null;
  private testIsLoggedIn: boolean | null = null;

  constructor(private readonly deps: SyncServiceDeps = {}) {}

  private get bindingStore(): BindingStore {
    return this.deps.bindingStore ?? defaultBindingStore;
  }

  private get tokenStore(): TokenStore {
    return this.deps.tokenStore ?? defaultTokenStore;
  }

  private get openExternal(): typeof shell.openExternal {
    return this.deps.openExternal ?? shell.openExternal;
  }

  private get oauthServerFactory(): () => OAuthServer {
    return this.deps.oauthServerFactory ?? (() => new OAuthServer());
  }

  private get dataDir(): string {
    return this.deps.dataDirProvider?.() ?? getStorage().dataDir;
  }

  private get storage(): FileStorage {
    return this.deps.storage ?? getStorage().storage;
  }

  private get gitFactory(): (dataDir: string, options: { remoteName?: string; remoteBranch?: string; env?: NodeJS.ProcessEnv }) => GitClient {
    return this.deps.gitFactory ?? ((dataDir: string, options: { remoteName?: string; remoteBranch?: string; env?: NodeJS.ProcessEnv }) => new (GitClient as any)(dataDir, options));
  }

  private get syncManagerFactory(): (git: GitClient, storage: FileStorage, options: { remoteName: string; remoteBranch: string }) => SyncManager {
    return this.deps.syncManagerFactory ?? ((git, storage, options) => new (SyncManager as any)(git, storage, options));
  }

  private get syncGit(): GitClientWithRemoteDefaultBranch {
    if (!this.git) {
      throw new Error('Git client not initialized');
    }

    return this.git as GitClientWithRemoteDefaultBranch;
  }

  private async ensureToken(): Promise<string> {
    const token = await this.tokenStore.getToken();
    if (token) {
      return token;
    }

    await this.login();
    const refreshed = await this.tokenStore.getToken();
    if (!refreshed) {
      throw new Error('GitHub login failed');
    }

    return refreshed;
  }

  private async ensureBindingLoaded(): Promise<RepositoryBinding | null> {
    if (this.binding) {
      return this.binding;
    }

    this.binding = await this.bindingStore.loadBinding();
    return this.binding;
  }

  private async ensureRuntime(
    binding?: RepositoryBinding,
    token?: string,
    options: { prepareBranch?: boolean } = {},
  ): Promise<RepositoryBinding> {
    const activeBinding = binding ?? (await this.ensureBindingLoaded());
    if (!activeBinding) {
      throw new Error('Repository not bound');
    }

    const activeToken = token ?? (await this.ensureToken());
    const needsGit = !this.git
      || this.binding?.repositoryUrl !== activeBinding.repositoryUrl
      || this.binding?.remoteBranch !== activeBinding.remoteBranch;

    if (needsGit) {
      this.git = this.gitFactory(this.dataDir, {
        remoteName: activeBinding.remoteName,
        remoteBranch: activeBinding.remoteBranch,
        env: createGitCredentialEnv(activeToken),
      });
      this.syncManager = this.syncManagerFactory(this.git, this.storage, {
        remoteName: activeBinding.remoteName,
        remoteBranch: activeBinding.remoteBranch,
      });
    }

    const git = this.syncGit;

    await git.init();
    await git.addRemote(activeBinding.remoteName, activeBinding.repositoryUrl);

    const remoteDefaultBranch = await git.getRemoteDefaultBranch(activeBinding.remoteName);
    if (remoteDefaultBranch && remoteDefaultBranch !== DEFAULT_REMOTE_BRANCH) {
      throw new Error('Remote default branch must be main');
    }

    if (options.prepareBranch) {
      await this.ensureLocalBranch(activeBinding.remoteBranch);
    }
    this.binding = activeBinding;
    return activeBinding;
  }

  private async ensureLocalBranch(branchName: string): Promise<void> {
    if (!this.git) {
      throw new Error('Git client not initialized');
    }

    const branches = await this.git.listBranches();
    if (branches.includes(branchName)) {
      await this.git.checkout(branchName);
      return;
    }

    await this.git.createBranch(branchName);
  }

  private async recordSuccessfulSync(binding?: RepositoryBinding): Promise<void> {
    const activeBinding = binding ?? this.binding;
    this.syncStatus = 'synced';
    this.lastError = null;
    this.conflictBranch = null;
    this.lastSyncTime = new Date().toISOString();

    if (activeBinding) {
      const updatedBinding: RepositoryBinding = {
        ...activeBinding,
        updatedAt: this.lastSyncTime,
      };
      this.binding = updatedBinding;
      await this.bindingStore.saveBinding(updatedBinding);
    }
  }

  private async recordSyncFailure(error: string): Promise<void> {
    this.syncStatus = 'error';
    this.lastError = error;
  }

  private async pushEmptyRemote(binding: RepositoryBinding): Promise<SyncResult> {
    if (!this.syncManager) {
      throw new Error('Sync manager not initialized');
    }

    await this.syncManager.commitChanges('sync: initial repository import');
    const result = await this.syncManager.pushChanges();

    if (result.success) {
      await this.recordSuccessfulSync(binding);
    } else {
      await this.recordSyncFailure(result.error || 'Sync failed');
    }

    return result;
  }

  async isLoggedIn(): Promise<boolean> {
    return this.tokenStore.hasToken();
  }

  async login(): Promise<boolean> {
    if (await this.tokenStore.hasToken()) {
      return true;
    }

    if (!GITHUB_CLIENT_ID) {
      throw new Error('GitHub client ID is not configured');
    }

    const oauthServer = this.oauthServerFactory();
    const port = await oauthServer.start();
    const redirectUri = `${GITHUB_REDIRECT_URI}:${port}/callback`;
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`;

    await this.openExternal(authUrl);

    try {
      const result: OAuthResult = await oauthServer.waitForCallback();

      if (result.error) {
        throw new Error(result.error);
      }

      const token = await this.exchangeCodeForToken(result.code, redirectUri);
      await this.tokenStore.saveToken(token);
      return true;
    } finally {
      await oauthServer.stop();
    }
  }

  private async exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
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
    await this.unbindRepository();
  }

  async bindRepository(repositoryUrl: string): Promise<SyncResult> {
    const parsed = parseGitHubRepositoryUrl(repositoryUrl);
    const token = await this.ensureToken();
    const binding = createRepositoryBinding(parsed.repositoryUrl, {
      remoteName: DEFAULT_REMOTE_NAME,
      remoteBranch: DEFAULT_REMOTE_BRANCH,
    });

    await this.ensureRuntime(binding, token, { prepareBranch: true });

    const remoteDefaultBranch = await this.syncGit.getRemoteDefaultBranch(binding.remoteName);
    if (remoteDefaultBranch && remoteDefaultBranch !== DEFAULT_REMOTE_BRANCH) {
      throw new Error('Remote default branch must be main');
    }

    await this.bindingStore.saveBinding(binding);
    this.binding = binding;
    this.syncStatus = 'syncing';
    this.lastError = null;

    if (!remoteDefaultBranch) {
      return this.pushEmptyRemote(binding);
    }

    return this.sync();
  }

  async unbindRepository(): Promise<void> {
    await this.tokenStore.deleteToken();
    await this.bindingStore.clearBinding();

    this.git = null;
    this.syncManager = null;
    this.binding = null;
    this.syncStatus = 'idle';
    this.lastSyncTime = null;
    this.lastError = null;
    this.conflictBranch = null;
    this.testIsLoggedIn = false;
  }

  async sync(): Promise<SyncResult> {
    const binding = await this.ensureRuntime();
    this.syncStatus = 'syncing';
    this.lastError = null;

    const remoteDefaultBranch = await this.syncGit.getRemoteDefaultBranch(binding.remoteName);
    if (!remoteDefaultBranch) {
      return this.pushEmptyRemote(binding);
    }

    if (!this.syncManager) {
      throw new Error('Sync manager not initialized');
    }

    const result = await this.syncManager.sync();
    if (result.success) {
      await this.recordSuccessfulSync(binding);
      return result;
    }

    if (result.status === 'conflict') {
      this.syncStatus = 'conflict';
      this.conflictBranch = result.conflictBranch ?? null;
      this.lastError = null;
      return result;
    }

    await this.recordSyncFailure(result.error || 'Sync failed');
    return result;
  }

  async resolveConflict(): Promise<SyncResult> {
    const binding = await this.ensureRuntime();
    this.syncStatus = 'syncing';
    this.lastError = null;

    if (!this.syncManager) {
      throw new Error('Sync manager not initialized');
    }

    const result = await this.syncManager.resolveConflictAndSync();
    if (result.success) {
      await this.recordSuccessfulSync(binding);
      return result;
    }

    if (result.status === 'conflict') {
      this.syncStatus = 'conflict';
      this.conflictBranch = result.conflictBranch ?? null;
      return result;
    }

    await this.recordSyncFailure(result.error || 'Sync failed');
    return result;
  }

  async rollback(): Promise<void> {
    await this.ensureRuntime();

    if (!this.syncManager) {
      throw new Error('Sync manager not initialized');
    }

    await this.syncManager.resetToRemote();
    this.syncStatus = 'idle';
    this.lastError = null;
    this.conflictBranch = null;
  }

  async getStatus(): Promise<SyncServiceStatus> {
    const binding = await this.ensureBindingLoaded();
    const isLoggedIn = this.testIsLoggedIn ?? await this.tokenStore.hasToken();

    const syncState = this.syncManager ? await this.syncManager.getStatus() : null;
    const syncStatus: SyncStatus = this.syncStatus !== 'idle'
      ? this.syncStatus
      : binding
        ? (syncState?.isClean ? 'synced' : 'idle')
        : 'idle';

    return {
      isLoggedIn,
      isBound: Boolean(binding),
      repositoryUrl: binding?.repositoryUrl ?? null,
      repositoryOwner: binding?.repositoryOwner ?? null,
      repositoryName: binding?.repositoryName ?? null,
      remoteName: binding?.remoteName ?? null,
      remoteBranch: binding?.remoteBranch ?? null,
      boundAt: binding?.boundAt ?? null,
      updatedAt: binding?.updatedAt ?? null,
      syncStatus,
      lastSyncTime: this.lastSyncTime ?? binding?.updatedAt ?? null,
      error: this.lastError,
      conflictBranch: this.conflictBranch,
    };
  }

  async seedTestState(payload: {
    isLoggedIn?: boolean;
    isBound?: boolean;
    repositoryUrl?: string | null;
    repositoryOwner?: string | null;
    repositoryName?: string | null;
    remoteName?: string | null;
    remoteBranch?: string | null;
    boundAt?: string | null;
    updatedAt?: string | null;
    syncStatus?: SyncStatus;
    lastSyncTime?: string | null;
    error?: string | null;
    conflictBranch?: string | null;
  }): Promise<void> {
    const isBound = payload.isBound ?? Boolean(payload.repositoryUrl);

    this.testIsLoggedIn = payload.isLoggedIn ?? null;
    this.syncStatus = payload.syncStatus ?? 'idle';
    this.lastSyncTime = payload.lastSyncTime ?? null;
    this.lastError = payload.error ?? null;
    this.conflictBranch = payload.conflictBranch ?? null;
    this.git = null;
    this.syncManager = null;

    if (!isBound || !payload.repositoryUrl || !payload.repositoryOwner || !payload.repositoryName) {
      this.binding = null;
      await this.bindingStore.clearBinding();
      return;
    }

    const now = payload.updatedAt ?? payload.boundAt ?? new Date().toISOString();
    this.binding = {
      repositoryUrl: payload.repositoryUrl,
      repositoryOwner: payload.repositoryOwner,
      repositoryName: payload.repositoryName,
      remoteName: (payload.remoteName ?? 'origin') as 'origin',
      remoteBranch: payload.remoteBranch ?? 'main',
      boundAt: payload.boundAt ?? now,
      updatedAt: payload.updatedAt ?? now,
    };

    await this.bindingStore.saveBinding(this.binding);
  }

  async getDataDir(): Promise<string> {
    return this.dataDir;
  }
}
