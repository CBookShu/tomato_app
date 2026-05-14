# GitHub 同步与绑定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Tomato App 的 GitHub 同步补成一套真正的 Git 仓库工作流，支持仓库 URL 绑定、GitHub 授权、空仓库首次初始化、远端已有数据的正常拉取合并、冲突保底分支，以及解绑恢复。

**Architecture:** 核心同步逻辑继续放在 `packages/core`，但改成可配置的 remote / branch / credential env，使 Git 操作本身保持纯粹。Electron 主进程负责把 GitHub token 通过临时 Git 配置注入给 `simple-git`，并持久化仓库绑定信息；renderer 只管理表单、状态展示和冲突提示。测试分三层：core 单元测试验证 Git 行为，main 进程测试验证绑定和凭证流，e2e 验证设置页和冲突 UI。

**Tech Stack:** TypeScript, `simple-git`, Electron IPC, Zustand, Jest, Vitest, Playwright, Node `fs/promises`

---

## 文件结构

### 新建文件

```
packages/core/tests/sync/
├── git-client.test.ts
└── sync-manager.test.ts

tomato_app/src/main/sync/
├── repository-binding.ts         # 仓库绑定持久化与 URL 解析
└── git-credentials.ts           # 临时 Git credential env 构造

tomato_app/tests/main/sync/
├── repository-binding.test.ts    # 绑定配置读写与 URL 解析
├── git-credentials.test.ts       # Git 凭证 env 生成
└── sync-service.test.ts          # bind / unbind / status 状态流

tomato_app/tests/e2e/
└── basic-acceptance-sync.spec.ts # 绑定、同步、冲突、解绑的端到端验收
```

### 修改文件

```
packages/core/
├── src/sync/git-client.ts
├── src/sync/sync-manager.ts
└── src/sync/index.ts

tomato_app/
├── src/main/sync/sync-service.ts
├── src/main/sync/index.ts
├── src/main/ipc-handlers.ts
├── src/shared/ipc-channels.ts
├── src/preload/index.ts
├── src/renderer/stores/sync-store.ts
├── src/renderer/components/Sync/SyncSettings.tsx
├── src/renderer/components/Sync/SyncStatus.tsx
├── src/renderer/components/Sync/ConflictPrompt.tsx
├── src/renderer/components/Sync/RepositoryField.tsx
└── src/renderer/components/Sync/SyncBindingStatus.tsx
```

---

## Task 1: Core Git Client and Conflict-Safe Sync

**Files:**
- Modify: `packages/core/src/sync/git-client.ts`
- Modify: `packages/core/src/sync/sync-manager.ts`
- Modify: `packages/core/src/sync/index.ts`
- Create: `packages/core/tests/sync/git-client.test.ts`
- Create: `packages/core/tests/sync/sync-manager.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/tests/sync/git-client.test.ts
import { describe, expect, jest, test } from '@jest/globals';
import { GitClient } from '../../src/sync/git-client.js';

const env = jest.fn().mockReturnThis();
const raw = jest.fn();
const pull = jest.fn();
const push = jest.fn();
const addRemote = jest.fn();
const init = jest.fn();
const addConfig = jest.fn();
const status = jest.fn();
const getRemotes = jest.fn();

jest.mock('simple-git', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    env,
    raw,
    pull,
    push,
    addRemote,
    init,
    addConfig,
    status,
    getRemotes,
  })),
}));

describe('GitClient', () => {
  test('applies credential env and keeps github token out of remote URL', () => {
    new GitClient('/tmp/repo', {
      env: {
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
        GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic dGVzdDp0b2tlbg==',
      },
    });

    expect(env).toHaveBeenCalledWith(
      expect.objectContaining({
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      }),
    );
  });

  test('parses the remote default branch from ls-remote symref output', async () => {
    raw.mockResolvedValueOnce('ref: refs/heads/main\tHEAD\n');
    const client = new GitClient('/tmp/repo');
    await expect(client.getRemoteDefaultBranch('origin')).resolves.toBe('main');
  });
});
```

```ts
// packages/core/tests/sync/sync-manager.test.ts
import { describe, expect, jest, test } from '@jest/globals';
import { SyncManager } from '../../src/sync/sync-manager.js';

test('pullChanges creates a backup branch when git reports a conflict', async () => {
  const git = {
    pull: jest.fn().mockResolvedValue({ success: false, hasConflicts: true }),
    rebaseAbort: jest.fn(),
    createBranch: jest.fn().mockResolvedValue(undefined),
    status: jest.fn().mockResolvedValue({ isClean: () => true, ahead: 0, behind: 0 }),
    hasChanges: jest.fn().mockResolvedValue(false),
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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd packages/core && npm test -- tests/sync/git-client.test.ts tests/sync/sync-manager.test.ts`
Expected: FAIL with `Cannot find module` and/or missing method errors for the new sync behavior.

- [ ] **Step 3: Implement the minimal core changes**

```ts
// packages/core/src/sync/git-client.ts
export interface GitClientOptions {
  remoteName?: string;
  remoteBranch?: string;
  env?: NodeJS.ProcessEnv;
}

constructor(private baseDir: string, private options: GitClientOptions = {}) {
  this.remoteName = options.remoteName ?? 'origin';
  this.remoteBranch = options.remoteBranch ?? 'main';
  this.git = simpleGit({ baseDir }).env(options.env ?? {});
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

async resetHard(ref: string): Promise<void> {
  await this.git.reset(['--hard', ref]);
}
```

```ts
// packages/core/src/sync/sync-manager.ts
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

async resetToRemote(): Promise<void> {
  await this.git.fetch(this.remoteName);
  await this.git.resetHard(`${this.remoteName}/${this.remoteBranch}`);
}

async sync(): Promise<SyncResult> {
  await this.commitChanges(`sync: local changes before pull`);
  const pullResult = await this.pullChanges();
  if (!pullResult.success) return pullResult;

  if (await this.git.hasChanges()) {
    await this.commitChanges();
    return this.pushChanges();
  }

  return pullResult;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `cd packages/core && npm test -- tests/sync/git-client.test.ts tests/sync/sync-manager.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/sync/git-client.ts packages/core/src/sync/sync-manager.ts packages/core/src/sync/index.ts packages/core/tests/sync/git-client.test.ts packages/core/tests/sync/sync-manager.test.ts
git commit -m "feat(sync): make git client branch-aware"
```

---

## Task 2: Main Process Binding, Credentials, and IPC

**Files:**
- Create: `tomato_app/src/main/sync/repository-binding.ts`
- Create: `tomato_app/src/main/sync/git-credentials.ts`
- Modify: `tomato_app/src/main/sync/sync-service.ts`
- Modify: `tomato_app/src/main/sync/index.ts`
- Modify: `tomato_app/src/main/ipc-handlers.ts`
- Modify: `tomato_app/src/shared/ipc-channels.ts`
- Modify: `tomato_app/src/preload/index.ts`
- Create: `tomato_app/tests/main/sync/repository-binding.test.ts`
- Create: `tomato_app/tests/main/sync/git-credentials.test.ts`
- Create: `tomato_app/tests/main/sync/sync-service.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tomato_app/tests/main/sync/repository-binding.test.ts
import { describe, expect, test } from 'vitest';
import { parseGitHubRepositoryUrl } from '../../../src/main/sync/repository-binding.js';

describe('parseGitHubRepositoryUrl', () => {
  test('accepts a full https GitHub URL', () => {
    expect(parseGitHubRepositoryUrl('https://github.com/you/tomato-data')).toEqual({
      repositoryUrl: 'https://github.com/you/tomato-data',
      repositoryOwner: 'you',
      repositoryName: 'tomato-data',
    });
  });

  test('rejects non-GitHub URLs', () => {
    expect(() => parseGitHubRepositoryUrl('https://example.com/you/tomato-data')).toThrow(
      'Repository URL must be a full https://github.com/<owner>/<repo> URL',
    );
  });
});
```

```ts
// tomato_app/tests/main/sync/git-credentials.test.ts
import { describe, expect, test } from 'vitest';
import { createGitCredentialEnv } from '../../../src/main/sync/git-credentials.js';

describe('createGitCredentialEnv', () => {
  test('creates a github-only temporary credential env', () => {
    const env = createGitCredentialEnv('ghp_test_token');
    expect(env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(env.GIT_CONFIG_KEY_0).toBe('http.https://github.com/.extraheader');
    expect(env.GIT_CONFIG_VALUE_0).toContain('AUTHORIZATION: basic ');
    expect(Buffer.from(env.GIT_CONFIG_VALUE_0!.split('basic ')[1], 'base64').toString()).toBe(
      'x-access-token:ghp_test_token',
    );
  });
});
```

```ts
// tomato_app/tests/main/sync/sync-service.test.ts
import { describe, expect, test, vi } from 'vitest';
import { SyncService } from '../../../src/main/sync/sync-service.js';

test('bindRepository stores binding metadata and getStatus reports isBound', async () => {
  const saveBinding = vi.fn();
  const loadBinding = vi.fn().mockResolvedValue(null);
  const clearBinding = vi.fn();
  const getToken = vi.fn().mockResolvedValue('ghp_test_token');
  const saveToken = vi.fn();
  const git = {
    init: vi.fn(),
    addRemote: vi.fn(),
    getRemoteDefaultBranch: vi.fn().mockResolvedValue('main'),
    add: vi.fn(),
    commit: vi.fn(),
    push: vi.fn(),
    fetch: vi.fn(),
    pull: vi.fn().mockResolvedValue({ success: true, hasConflicts: false }),
    hasChanges: vi.fn().mockResolvedValue(false),
    resetHard: vi.fn(),
    createBranch: vi.fn(),
    status: vi.fn().mockResolvedValue({ isClean: () => true, ahead: 0, behind: 0 }),
  };

  const service = new SyncService({
    bindingStore: { loadBinding, saveBinding, clearBinding },
    tokenStore: { getToken, saveToken, deleteToken: vi.fn(), hasToken: vi.fn().mockResolvedValue(true) },
    gitFactory: vi.fn(() => git as any),
    openExternal: vi.fn(),
  } as any);

  await service.bindRepository('https://github.com/you/tomato-data');
  const status = await service.getStatus();

  expect(saveBinding).toHaveBeenCalledWith(
    expect.objectContaining({
      repositoryUrl: 'https://github.com/you/tomato-data',
      repositoryOwner: 'you',
      repositoryName: 'tomato-data',
      remoteName: 'origin',
      remoteBranch: 'main',
    }),
  );
  expect(status.isBound).toBe(true);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd tomato_app && npm test -- tests/main/sync/repository-binding.test.ts tests/main/sync/git-credentials.test.ts tests/main/sync/sync-service.test.ts`
Expected: FAIL with missing modules / missing methods for binding, credential env, and repository-aware sync flow.

- [ ] **Step 3: Implement the main-process sync bridge**

```ts
// tomato_app/src/main/sync/repository-binding.ts
export interface RepositoryBinding {
  repositoryUrl: string;
  repositoryOwner: string;
  repositoryName: string;
  remoteName: 'origin';
  remoteBranch: string;
  boundAt: string;
  lastSyncTime: string | null;
}

export function parseGitHubRepositoryUrl(input: string): {
  repositoryUrl: string;
  repositoryOwner: string;
  repositoryName: string;
} {
  const match = input.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/);
  if (!match) {
    throw new Error('Repository URL must be a full https://github.com/<owner>/<repo> URL');
  }

  return {
    repositoryUrl: `https://github.com/${match[1]}/${match[2]}`,
    repositoryOwner: match[1],
    repositoryName: match[2],
  };
}
```

```ts
// tomato_app/src/main/sync/git-credentials.ts
export function createGitCredentialEnv(token: string): NodeJS.ProcessEnv {
  return {
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
  };
}
```

```ts
// tomato_app/src/main/sync/sync-service.ts
interface SyncServiceDeps {
  bindingStore?: {
    loadBinding: () => Promise<RepositoryBinding | null>;
    saveBinding: (binding: RepositoryBinding) => Promise<void>;
    clearBinding: () => Promise<void>;
  };
  tokenStore?: {
    getToken: () => Promise<string | null>;
    saveToken: (token: string) => Promise<void>;
    deleteToken: () => Promise<void>;
    hasToken: () => Promise<boolean>;
  };
  gitFactory?: (dataDir: string, env: NodeJS.ProcessEnv) => GitClient;
  openExternal?: typeof shell.openExternal;
  oauthServerFactory?: () => OAuthServer;
  dataDirProvider?: () => string;
}

const defaultBindingStore = { loadBinding, saveBinding, clearBinding };
const defaultTokenStore = { getToken, saveToken, deleteToken, hasToken };

constructor(private deps: SyncServiceDeps = {}) {}

private get dataDir(): string {
  return this.deps.dataDirProvider?.() ?? getStorage().dataDir;
}

private get bindingStore() {
  return this.deps.bindingStore ?? defaultBindingStore;
}

private get tokenStore() {
  return this.deps.tokenStore ?? defaultTokenStore;
}

private get openExternal() {
  return this.deps.openExternal ?? shell.openExternal;
}

private get oauthServerFactory() {
  return this.deps.oauthServerFactory ?? (() => new OAuthServer());
}

private get gitFactory() {
  return this.deps.gitFactory ?? ((dataDir: string, env: NodeJS.ProcessEnv) => new GitClient(dataDir, { env }));
}

async login(): Promise<boolean> {
  const oauthServer = this.oauthServerFactory();
  const port = await oauthServer.start();

  const redirectUri = `${GITHUB_REDIRECT_URI}:${port}/callback`;
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`;

  await this.openExternal(authUrl);
}

async ensureToken(): Promise<string> {
  const token = await this.tokenStore.getToken();
  if (token) return token;

  await this.login();
  const refreshed = await this.tokenStore.getToken();
  if (!refreshed) {
    throw new Error('GitHub login failed');
  }

  return refreshed;
}

async bindRepository(repositoryUrl: string): Promise<SyncResult> {
  const parsed = parseGitHubRepositoryUrl(repositoryUrl);
  const token = await this.ensureToken();

  const binding = {
    repositoryUrl: parsed.repositoryUrl,
    repositoryOwner: parsed.repositoryOwner,
    repositoryName: parsed.repositoryName,
    remoteName: 'origin' as const,
    remoteBranch: 'main',
    boundAt: new Date().toISOString(),
    lastSyncTime: null,
  };

  this.git = this.gitFactory(this.dataDir, createGitCredentialEnv(token));
  await this.git.init();

  const remoteBranch = await this.git.getRemoteDefaultBranch('origin');
  if (remoteBranch && remoteBranch !== 'main') {
    throw new Error('Remote default branch must be main');
  }

  await this.bindingStore.saveBinding(binding);
  this.syncManager = new SyncManager(this.git, getStorage().storage, { remoteName: 'origin', remoteBranch: 'main' });

  return this.sync();
}

async unbindRepository(): Promise<void> {
  await this.tokenStore.deleteToken();
  await this.bindingStore.clearBinding();
  this.git = null;
  this.syncManager = null;
}

async getStatus(): Promise<{ isLoggedIn: boolean; isBound: boolean; repositoryUrl?: string; repositoryOwner?: string; repositoryName?: string; remoteBranch?: string; syncStatus?: string }> {
  const loggedIn = await this.tokenStore.hasToken();
  const binding = await this.bindingStore.loadBinding();
  const status = this.syncManager ? await this.syncManager.getStatus() : { isClean: true, ahead: 0, behind: 0 };

  return {
    isLoggedIn: loggedIn,
    isBound: Boolean(binding),
    repositoryUrl: binding?.repositoryUrl,
    repositoryOwner: binding?.repositoryOwner,
    repositoryName: binding?.repositoryName,
    remoteBranch: binding?.remoteBranch,
    syncStatus: binding ? (status.isClean ? 'synced' : 'pending') : 'idle',
  };
}
```

- [ ] **Step 4: Wire IPC and preload methods**

```ts
// tomato_app/src/shared/ipc-channels.ts
export const IPC = {
  SYNC_BIND_REPOSITORY: 'sync:bind-repository',
  SYNC_UNBIND_REPOSITORY: 'sync:unbind-repository',
  SYNC_GET_STATUS: 'sync:get-status',
  SYNC_SYNC: 'sync:sync',
  SYNC_RESOLVE_CONFLICT: 'sync:resolve-conflict',
  SYNC_ROLLBACK: 'sync:rollback',
  SYNC_GET_DATA_DIR: 'sync:get-data-dir',
} as const;

export interface IpcChannelMap {
  [IPC.SYNC_BIND_REPOSITORY]: { request: { repositoryUrl: string }; response: SyncResult };
  [IPC.SYNC_UNBIND_REPOSITORY]: { request: void; response: void };
  [IPC.SYNC_GET_STATUS]: {
    request: void;
    response: {
      isLoggedIn: boolean;
      isBound: boolean;
      repositoryUrl?: string;
      repositoryOwner?: string;
      repositoryName?: string;
      remoteBranch?: string;
      syncStatus?: string;
    };
  };
  [IPC.SYNC_SYNC]: { request: void; response: SyncResult };
  [IPC.SYNC_RESOLVE_CONFLICT]: { request: void; response: SyncResult };
  [IPC.SYNC_ROLLBACK]: { request: void; response: void };
  [IPC.SYNC_GET_DATA_DIR]: { request: void; response: string };
}
```

```ts
// tomato_app/src/preload/index.ts
sync: {
  bindRepository: (repositoryUrl: string) => ipcRenderer.invoke(SYNC.SYNC_BIND_REPOSITORY, { repositoryUrl }),
  unbindRepository: () => ipcRenderer.invoke(SYNC.SYNC_UNBIND_REPOSITORY),
  getStatus: () => ipcRenderer.invoke(SYNC.SYNC_GET_STATUS),
  sync: () => ipcRenderer.invoke(SYNC.SYNC_SYNC),
  resolveConflict: () => ipcRenderer.invoke(SYNC.SYNC_RESOLVE_CONFLICT),
  rollback: () => ipcRenderer.invoke(SYNC.SYNC_ROLLBACK),
  getDataDir: () => ipcRenderer.invoke(SYNC.SYNC_GET_DATA_DIR),
},
```

```ts
// tomato_app/src/main/ipc-handlers.ts
ipcMain.handle(IPC.SYNC_BIND_REPOSITORY, async (_event, payload: { repositoryUrl: string }) => {
  return syncService.bindRepository(payload.repositoryUrl);
});

ipcMain.handle(IPC.SYNC_UNBIND_REPOSITORY, async () => {
  return syncService.unbindRepository();
});
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `cd tomato_app && npm test -- tests/main/sync/repository-binding.test.ts tests/main/sync/git-credentials.test.ts tests/main/sync/sync-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tomato_app/src/main/sync/repository-binding.ts tomato_app/src/main/sync/git-credentials.ts tomato_app/src/main/sync/sync-service.ts tomato_app/src/main/sync/index.ts tomato_app/src/main/ipc-handlers.ts tomato_app/src/shared/ipc-channels.ts tomato_app/src/preload/index.ts tomato_app/tests/main/sync/repository-binding.test.ts tomato_app/tests/main/sync/git-credentials.test.ts tomato_app/tests/main/sync/sync-service.test.ts
git commit -m "feat(sync): add repository binding bridge"
```

---

## Task 3: Renderer Sync State and Settings UI

**Files:**
- Modify: `tomato_app/src/renderer/stores/sync-store.ts`
- Modify: `tomato_app/src/renderer/components/Sync/SyncSettings.tsx`
- Modify: `tomato_app/src/renderer/components/Sync/SyncStatus.tsx`
- Modify: `tomato_app/src/renderer/components/Sync/ConflictPrompt.tsx`
- Create: `tomato_app/src/renderer/components/Sync/RepositoryField.tsx`
- Create: `tomato_app/src/renderer/components/Sync/SyncBindingStatus.tsx`
- Modify: `tomato_app/src/renderer/components/Settings/SettingsPage.tsx` only if the new sync card needs a layout tweak
- Create: `tomato_app/tests/stores/sync-store.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tomato_app/tests/stores/sync-store.test.ts
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useSyncStore } from '../../src/renderer/stores/sync-store.js';

beforeEach(() => {
  vi.stubGlobal('window', {
    electronAPI: {
      invoke: vi.fn(),
      on: vi.fn(),
      sync: {
        bindRepository: vi.fn(),
        unbindRepository: vi.fn(),
        getStatus: vi.fn(),
        sync: vi.fn(),
        resolveConflict: vi.fn(),
        rollback: vi.fn(),
        getDataDir: vi.fn(),
      },
    },
  } as any);
  useSyncStore.setState({
    status: 'idle',
    isLoggedIn: false,
    isBound: false,
    repositoryUrl: null,
    repositoryOwner: null,
    repositoryName: null,
    remoteBranch: null,
    lastSyncTime: null,
    error: null,
    conflictBranch: null,
    dataDir: null,
  });
});

test('connectRepository stores repository metadata and marks the app bound', async () => {
  window.electronAPI.sync.bindRepository = vi.fn().mockResolvedValue({ success: true, status: 'synced' });
  window.electronAPI.sync.getStatus = vi.fn().mockResolvedValue({
    isLoggedIn: true,
    isBound: true,
    repositoryUrl: 'https://github.com/you/tomato-data',
    repositoryOwner: 'you',
    repositoryName: 'tomato-data',
    remoteBranch: 'main',
    syncStatus: 'synced',
  });

  await useSyncStore.getState().bindRepository('https://github.com/you/tomato-data');

  expect(useSyncStore.getState().isBound).toBe(true);
  expect(useSyncStore.getState().repositoryName).toBe('tomato-data');
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd tomato_app && npm test -- tests/stores/sync-store.test.ts`
Expected: FAIL because the store still only knows login/logout and does not track repository binding.

- [ ] **Step 3: Implement the renderer state and sync card**

```ts
// tomato_app/src/renderer/stores/sync-store.ts
interface SyncState {
  status: SyncStatus;
  isLoggedIn: boolean;
  isBound: boolean;
  repositoryUrl: string | null;
  repositoryOwner: string | null;
  repositoryName: string | null;
  remoteBranch: string | null;
  lastSyncTime: string | null;
  error: string | null;
  conflictBranch: string | null;
  dataDir: string | null;
}

interface SyncActions {
  bindRepository: (repositoryUrl: string) => Promise<SyncResult>;
  unbindRepository: () => Promise<void>;
  getStatus: () => Promise<void>;
  getDataDir: () => Promise<void>;
  sync: () => Promise<SyncResult>;
  resolveConflict: () => Promise<SyncResult>;
  rollback: () => Promise<void>;
  reset: () => void;
}

bindRepository: async (repositoryUrl: string) => {
  set({ status: 'syncing', error: null });
  const result = await window.electronAPI.sync.bindRepository(repositoryUrl);
  await get().getStatus();
  return result;
},

unbindRepository: async () => {
  await window.electronAPI.sync.unbindRepository();
  set({ ...initialState });
},

getStatus: async () => {
  const status = await window.electronAPI.sync.getStatus();
  set({
    isLoggedIn: status.isLoggedIn,
    isBound: status.isBound,
    repositoryUrl: status.repositoryUrl ?? null,
    repositoryOwner: status.repositoryOwner ?? null,
    repositoryName: status.repositoryName ?? null,
    remoteBranch: status.remoteBranch ?? null,
    status: (status.syncStatus as SyncStatus) || 'idle',
  });
},

getDataDir: async () => {
  const dataDir = await window.electronAPI.sync.getDataDir();
  set({ dataDir });
},
```

```tsx
// tomato_app/src/renderer/components/Sync/RepositoryField.tsx
interface RepositoryFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function RepositoryField({ value, onChange, onSubmit, disabled }: RepositoryFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">GitHub 仓库地址</label>
      <input
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://github.com/you/tomato-data"
        disabled={disabled}
      />
      <button className="px-4 py-2 text-sm bg-gray-800 text-white rounded" onClick={onSubmit} disabled={disabled}>
        验证并连接
      </button>
    </div>
  );
}
```

```tsx
// tomato_app/src/renderer/components/Sync/SyncBindingStatus.tsx
interface SyncBindingStatusProps {
  isLoggedIn: boolean;
  isBound: boolean;
  repositoryName: string | null;
  remoteBranch: string | null;
  statusText: string;
}
```

```tsx
// tomato_app/src/renderer/components/Sync/SyncSettings.tsx
const [repositoryUrl, setRepositoryUrl] = useState('');

const handleBind = async () => {
  await bindRepository(repositoryUrl);
  await getStatus();
};

return (
  <div className="p-4 space-y-6">
    <RepositoryField value={repositoryUrl} onChange={setRepositoryUrl} onSubmit={handleBind} disabled={status === 'syncing'} />
    <SyncBindingStatus
      isLoggedIn={isLoggedIn}
      isBound={isBound}
      repositoryName={repositoryName}
      remoteBranch={remoteBranch}
      statusText={config.text}
    />
    {isBound && (
      <button onClick={unbindRepository} className="px-3 py-1.5 text-sm border border-gray-300 rounded">
        解绑
      </button>
    )}
  </div>
);
```

```tsx
// tomato_app/src/renderer/components/Sync/ConflictPrompt.tsx
const handleManualResolve = () => {
  reset();
  onClose?.();
};
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `cd tomato_app && npm test -- tests/stores/sync-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tomato_app/src/renderer/stores/sync-store.ts tomato_app/src/renderer/components/Sync/SyncSettings.tsx tomato_app/src/renderer/components/Sync/SyncStatus.tsx tomato_app/src/renderer/components/Sync/ConflictPrompt.tsx tomato_app/src/renderer/components/Sync/RepositoryField.tsx tomato_app/src/renderer/components/Sync/SyncBindingStatus.tsx tomato_app/src/renderer/components/Settings/SettingsPage.tsx tomato_app/tests/stores/sync-store.test.ts
git commit -m "feat(sync): add binding ui and renderer state"
```

---

## Task 4: E2E Acceptance and Test-Only Sync Seeding

**Files:**
- Modify: `tomato_app/src/main/ipc-handlers.ts`
- Modify: `tomato_app/tests/e2e/helpers/acceptance-helpers.ts`
- Create: `tomato_app/tests/e2e/basic-acceptance-sync.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tomato_app/tests/e2e/basic-acceptance-sync.spec.ts
import { test, expect } from './fixtures';
import { clearDataAndReload, seedSyncBinding } from './helpers/acceptance-helpers';

test('sync settings can show a bound repository and unbind it', async ({ page, electronApp }) => {
  await clearDataAndReload(page, electronApp);

  await seedSyncBinding(page, {
    isLoggedIn: true,
    isBound: true,
    repositoryUrl: 'https://github.com/you/tomato-data',
    repositoryOwner: 'you',
    repositoryName: 'tomato-data',
    remoteBranch: 'main',
    status: 'synced',
    lastSyncTime: '2026-05-13T12:00:00.000Z',
  });

  await page.getByRole('tab', { name: '设置' }).click();
  await expect(page.getByText('tomato-data')).toBeVisible();
  await expect(page.getByText('main')).toBeVisible();

  await page.getByRole('button', { name: '解绑' }).click();
  await expect(page.getByText('未绑定')).toBeVisible();
});
```

```ts
// tomato_app/tests/e2e/basic-acceptance-sync.spec.ts
test('conflict prompt keeps the backup branch visible until the user acknowledges it', async ({ page, electronApp }) => {
  await clearDataAndReload(page, electronApp);

  await seedSyncBinding(page, {
    isLoggedIn: true,
    isBound: true,
    repositoryUrl: 'https://github.com/you/tomato-data',
    repositoryOwner: 'you',
    repositoryName: 'tomato-data',
    remoteBranch: 'main',
    status: 'conflict',
    conflictBranch: 'local-backup-2026-05-13T12-30-00',
  });

  await expect(page.getByText('local-backup-2026-05-13T12-30-00')).toBeVisible();
  await page.getByRole('button', { name: '回滚到远程版本' }).click();
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd tomato_app && npm run test:e2e -- tests/e2e/basic-acceptance-sync.spec.ts`
Expected: FAIL because the test-only sync seed hook and the renderer binding UI do not exist yet.

- [ ] **Step 3: Add test-only sync seed hooks and wire the acceptance helpers**

```ts
// tomato_app/src/main/ipc-handlers.ts
if (process.env.NODE_ENV === 'test') {
  ipcMain.handle('test:sync-seed-binding', async (_event, payload) => {
    await syncService.__setBindingForTest(payload);
    return { success: true };
  });
}
```

```ts
// tomato_app/src/main/sync/sync-service.ts
async __setBindingForTest(payload: {
  isLoggedIn?: boolean;
  isBound?: boolean;
  repositoryUrl?: string;
  repositoryOwner?: string;
  repositoryName?: string;
  remoteBranch?: string;
  status?: SyncStatus;
  lastSyncTime?: string | null;
  conflictBranch?: string | null;
}): Promise<void> {
  this.binding = payload.isBound
    ? {
        repositoryUrl: payload.repositoryUrl ?? 'https://github.com/you/tomato-data',
        repositoryOwner: payload.repositoryOwner ?? 'you',
        repositoryName: payload.repositoryName ?? 'tomato-data',
        remoteName: 'origin',
        remoteBranch: payload.remoteBranch ?? 'main',
        boundAt: new Date().toISOString(),
        lastSyncTime: payload.lastSyncTime ?? null,
      }
    : null;
  this.status = payload.status ?? 'idle';
  this.conflictBranch = payload.conflictBranch ?? null;
}
```

```ts
// tomato_app/tests/e2e/helpers/acceptance-helpers.ts
export async function seedSyncBinding(page: Page, payload: Record<string, unknown>) {
  await page.evaluate(
    async ({ payload }) => {
      await window.electronAPI.invoke('test:sync-seed-binding', payload);
    },
    { payload },
  );
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `cd tomato_app && npm run test:e2e -- tests/e2e/basic-acceptance-sync.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tomato_app/src/main/ipc-handlers.ts tomato_app/tests/e2e/helpers/acceptance-helpers.ts tomato_app/tests/e2e/basic-acceptance-sync.spec.ts
git commit -m "test(sync): add binding e2e coverage"
```

---

## Self-Review Checklist

1. **Spec coverage**
   - Core repo-agnostic Git behavior is covered by Task 1.
   - GitHub URL parsing, binding persistence, and credential env injection are covered by Task 2.
   - Renderer status, binding UI, and conflict dialog behavior are covered by Task 3.
   - End-to-end UI verification and test-only state seeding are covered by Task 4.

2. **Placeholder scan**
   - No `TBD`, `TODO`, or “fill in later” language remains in the task steps.
   - Every test step names a concrete command and expected outcome.

3. **Type consistency**
   - `remoteBranch` is used consistently across core, main, renderer, and tests.
   - `bindRepository`, `unbindRepository`, `getStatus`, and `sync` are the shared action names.
   - Conflict behavior keeps `conflictBranch` as the visible payload between core and renderer.

4. **Scope check**
   - The plan stays within one product slice: GitHub sync binding plus sync flow.
   - It does not expand into unrelated UI redesign or broader data model refactors.
