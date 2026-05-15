import type { FileStorage, SyncResult, SyncStatus } from '@pomodoro/core';
import { GitClient, SyncManager } from '@pomodoro/core';
import { getStorage } from '../database.js';
import { createGitCredentialEnv } from './git-credentials.js';
import { createRepositoryBinding, RepositoryBindingStore, type RepositoryBinding } from './repository-binding.js';

const DEFAULT_REMOTE_NAME: 'origin' = 'origin';

interface BindingRecord extends RepositoryBinding {
  repositoryUrl?: string;
  repositoryOwner?: string | null;
  repositoryName?: string | null;
  remoteName?: 'origin';
}

interface BindingStore {
  loadBinding: () => Promise<BindingRecord | null>;
  saveBinding: (binding: BindingRecord) => Promise<void>;
  clearBinding: () => Promise<void>;
}

interface SyncServiceDeps {
  bindingStore?: BindingStore;
  gitFactory?: (dataDir: string, options: { remoteName?: string; remoteBranch?: string; env?: NodeJS.ProcessEnv }) => GitClient;
  syncManagerFactory?: (git: GitClient, storage: FileStorage, options: { remoteName: string; remoteBranch: string }) => SyncManager;
  dataDirProvider?: () => string;
  storage?: FileStorage;
}

type GitClientWithRemoteDefaultBranch = GitClient & {
  getRemoteDefaultBranch: (remote?: string) => Promise<string | null>;
};

export interface SyncServiceStatus {
  isLoggedIn: boolean;
  isBound: boolean;
  remoteUrl: string | null;
  remoteLabel: string | null;
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

const defaultBindingStore = new RepositoryBindingStore() as unknown as BindingStore;

function normalizeBinding(binding: BindingRecord | null): BindingRecord | null {
  if (!binding) {
    return null;
  }

  const remoteUrl = (binding.remoteUrl ?? binding.repositoryUrl ?? '').trim();
  const remoteLabel = (binding.remoteLabel ?? remoteUrl).trim();
  const remoteBranch = (binding.remoteBranch ?? '').trim();

  if (!remoteUrl || !remoteBranch) {
    return null;
  }

  return {
    remoteUrl,
    remoteLabel: remoteLabel || remoteUrl,
    remoteBranch,
    boundAt: binding.boundAt,
    updatedAt: binding.updatedAt,
    repositoryUrl: binding.repositoryUrl ?? remoteUrl,
    repositoryOwner: binding.repositoryOwner ?? null,
    repositoryName: binding.repositoryName ?? null,
    remoteName: 'origin',
  };
}

function createBindingRecord(remoteUrl: string, remoteBranch: string, now: Date = new Date()): BindingRecord {
  const binding = createRepositoryBinding(remoteUrl, remoteBranch, now);
  return {
    ...binding,
    repositoryUrl: binding.remoteUrl,
    repositoryOwner: null,
    repositoryName: null,
    remoteName: 'origin',
  };
}

export class SyncService {
  private git: GitClient | null = null;
  private syncManager: SyncManager | null = null;
  private binding: BindingRecord | null = null;
  private syncStatus: SyncStatus = 'idle';
  private lastSyncTime: string | null = null;
  private lastError: string | null = null;
  private conflictBranch: string | null = null;
  private testIsLoggedIn: boolean | null = null;

  constructor(private readonly deps: SyncServiceDeps = {}) {}

  private get bindingStore(): BindingStore {
    return this.deps.bindingStore ?? defaultBindingStore;
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

  private async ensureBindingLoaded(): Promise<BindingRecord | null> {
    if (this.binding) {
      return this.binding;
    }

    this.binding = normalizeBinding(await this.bindingStore.loadBinding());
    return this.binding;
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

  private async ensureRuntime(
    binding?: BindingRecord,
    options: { prepareBranch?: boolean } = {},
  ): Promise<BindingRecord> {
    const activeBinding = binding ?? (await this.ensureBindingLoaded());

    if (!activeBinding) {
      throw new Error('Repository not bound');
    }

    const needsGit = !this.git
      || !this.binding
      || this.binding.remoteUrl !== activeBinding.remoteUrl
      || this.binding.remoteBranch !== activeBinding.remoteBranch;

    if (needsGit) {
      this.git = this.gitFactory(this.dataDir, {
        remoteName: DEFAULT_REMOTE_NAME,
        remoteBranch: activeBinding.remoteBranch,
        env: createGitCredentialEnv(),
      });

      this.syncManager = this.syncManagerFactory(this.git, this.storage, {
        remoteName: DEFAULT_REMOTE_NAME,
        remoteBranch: activeBinding.remoteBranch,
      });
    }

    const git = this.syncGit;

    await git.init();
    await git.addRemote(DEFAULT_REMOTE_NAME, activeBinding.remoteUrl);

    if (options.prepareBranch) {
      await this.ensureLocalBranch(activeBinding.remoteBranch);
    }

    this.binding = activeBinding;
    return activeBinding;
  }

  private async recordSuccessfulSync(binding?: BindingRecord): Promise<void> {
    const activeBinding = binding ?? this.binding;
    const timestamp = new Date().toISOString();

    this.syncStatus = 'synced';
    this.lastError = null;
    this.conflictBranch = null;
    this.lastSyncTime = timestamp;

    if (activeBinding) {
      const updatedBinding: BindingRecord = {
        ...activeBinding,
        updatedAt: timestamp,
      };

      this.binding = updatedBinding;
      await this.bindingStore.saveBinding(updatedBinding);
    }
  }

  private async recordSyncFailure(error: string): Promise<void> {
    this.syncStatus = 'error';
    this.lastError = error;
    this.conflictBranch = null;
  }

  private async pushInitialState(binding: BindingRecord): Promise<SyncResult> {
    if (!this.syncManager) {
      throw new Error('Sync manager not initialized');
    }

    await this.syncManager.commitChanges('sync: initial repository import');
    const result = await this.syncManager.pushChanges();

    if (result.success) {
      await this.recordSuccessfulSync(binding);
      return result;
    }

    await this.recordSyncFailure(result.error || 'Sync failed');
    return result;
  }

  async bindRepository(remoteUrl: string, remoteBranch: string): Promise<SyncResult> {
    const normalizedRemoteUrl = remoteUrl.trim();
    const normalizedRemoteBranch = remoteBranch.trim();
    const activeBinding = await this.ensureBindingLoaded();

    if (
      this.syncStatus === 'conflict'
      && this.conflictBranch
      && activeBinding
      && activeBinding.remoteUrl === normalizedRemoteUrl
      && activeBinding.remoteBranch === normalizedRemoteBranch
    ) {
      return {
        success: false,
        status: 'conflict',
        conflictBranch: this.conflictBranch,
      };
    }

    const binding = createBindingRecord(remoteUrl, remoteBranch);

    await this.ensureRuntime(binding, { prepareBranch: true });
    await this.bindingStore.saveBinding(binding);

    this.syncStatus = 'syncing';
    this.lastError = null;

    const remoteDefaultBranch = await this.syncGit.getRemoteDefaultBranch(DEFAULT_REMOTE_NAME);
    if (!remoteDefaultBranch) {
      return this.pushInitialState(binding);
    }

    return this.sync();
  }

  async unbindRepository(): Promise<void> {
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
      this.lastError = null;
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
    const syncState = this.syncManager ? await this.syncManager.getStatus() : null;
    const syncStatus: SyncStatus = this.syncStatus !== 'idle'
      ? this.syncStatus
      : binding
        ? (syncState?.isClean ? 'synced' : 'idle')
        : 'idle';

    return {
      isLoggedIn: this.testIsLoggedIn ?? Boolean(binding),
      isBound: Boolean(binding),
      remoteUrl: binding?.remoteUrl ?? null,
      remoteLabel: binding?.remoteLabel ?? null,
      repositoryUrl: binding?.repositoryUrl ?? binding?.remoteUrl ?? null,
      repositoryOwner: binding?.repositoryOwner ?? null,
      repositoryName: binding?.repositoryName ?? null,
      remoteName: binding ? DEFAULT_REMOTE_NAME : null,
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
    remoteUrl?: string | null;
    remoteLabel?: string | null;
    remoteBranch?: string | null;
    repositoryUrl?: string | null;
    repositoryOwner?: string | null;
    repositoryName?: string | null;
    boundAt?: string | null;
    updatedAt?: string | null;
    syncStatus?: SyncStatus;
    lastSyncTime?: string | null;
    error?: string | null;
    conflictBranch?: string | null;
  }): Promise<void> {
    const isBound = payload.isBound ?? Boolean(payload.remoteUrl ?? payload.repositoryUrl);

    this.testIsLoggedIn = payload.isLoggedIn ?? null;
    this.syncStatus = payload.syncStatus ?? 'idle';
    this.lastSyncTime = payload.lastSyncTime ?? null;
    this.lastError = payload.error ?? null;
    this.conflictBranch = payload.conflictBranch ?? null;
    this.git = null;
    this.syncManager = null;

    const remoteUrl = payload.remoteUrl ?? payload.repositoryUrl ?? null;
    if (!isBound || !remoteUrl) {
      this.binding = null;
      await this.bindingStore.clearBinding();
      return;
    }

    const now = payload.updatedAt ?? payload.boundAt ?? new Date().toISOString();
    this.binding = normalizeBinding({
      remoteUrl,
      remoteLabel: payload.remoteLabel ?? remoteUrl,
      remoteBranch: payload.remoteBranch ?? 'main',
      boundAt: payload.boundAt ?? now,
      updatedAt: payload.updatedAt ?? now,
      repositoryUrl: payload.repositoryUrl ?? remoteUrl,
      repositoryOwner: payload.repositoryOwner ?? null,
      repositoryName: payload.repositoryName ?? null,
      remoteName: 'origin',
    });

    if (!this.binding) {
      await this.bindingStore.clearBinding();
      return;
    }

    await this.bindingStore.saveBinding(this.binding);
  }

  async getDataDir(): Promise<string> {
    return this.dataDir;
  }
}
