# Git Sync Local-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current GitHub-specific sync flow with a local-first Git remote sync flow that binds a user-selected remote and branch, preserves local data on conflict, and exposes the new model in settings UI.

**Architecture:** Split the work into a small sync domain layer, a main-process service that orchestrates binding and sync, and a renderer layer that only reflects status and triggers actions. Remove OAuth/token assumptions entirely, keep the sync state machine explicit, and make the settings UI the only place users manage binding, sync, and unbinding.

**Tech Stack:** Electron, TypeScript, React, Zustand, simple-git, Vitest, Playwright

---

## File Structure

```
tomato_app/src/main/sync/
├── repository-binding.ts     # Rework: store generic remote URL + branch binding
├── git-credentials.ts        # Rework: remove GitHub-specific auth header handling
├── sync-service.ts           # Rework: local-first sync orchestration, no OAuth
└── index.ts                  # Re-export updated sync API

tomato_app/src/main/
├── ipc-handlers.ts           # Rework: sync IPC handlers and test seed payloads
└── database.ts               # No sync changes unless test reset helpers need it

tomato_app/src/shared/
└── ipc-channels.ts           # Rework: remove login/logout channels, add new bind payload

tomato_app/src/preload/
└── index.ts                  # Rework: expose the updated sync bridge

tomato_app/src/renderer/
├── stores/sync-store.ts      # Rework: remove login state, reflect new sync status
└── components/Sync/
    ├── SyncSettings.tsx      # Rework: remote + branch inputs, no GitHub login button
    ├── RepositoryField.tsx   # Rework: generic remote label and branch field(s)
    ├── SyncBindingStatus.tsx  # Rework: show remote, branch, sync status, unbind
    ├── SyncStatus.tsx        # Rework: sync-only action + readable errors
    └── ConflictPrompt.tsx    # Rework: clarify conflict recovery action

tomato_app/tests/main/sync/
├── repository-binding.test.ts # Rework: parse/save generic remote binding
└── sync-service.test.ts       # Rework: local-first binding, empty remote, conflict flow

tomato_app/tests/stores/
└── sync-store.test.ts         # Rework: store state mapping for new sync model

tomato_app/tests/e2e/
└── basic-acceptance-sync.spec.ts # Rework: settings-page acceptance for bind/sync/unbind/conflict
```

---

### Task 1: Redefine the sync binding model

**Files:**
- Modify: `tomato_app/src/main/sync/repository-binding.ts`
- Modify: `tomato_app/tests/main/sync/repository-binding.test.ts`

- [ ] **Step 1: Write the failing tests for generic binding storage**

```typescript
import { afterEach, describe, expect, test, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/tmp/tomato-user-data') } }));
import {
  createRepositoryBinding,
  parseRemoteBinding,
  RepositoryBindingStore,
} from '../../../src/main/sync/repository-binding.js';

describe('parseRemoteBinding', () => {
  test('accepts a remote url and branch', () => {
    expect(parseRemoteBinding('https://example.com/team/tomato.git', 'main')).toEqual({
      remoteUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
    });
  });

  test('rejects an empty branch', () => {
    expect(() => parseRemoteBinding('https://example.com/team/tomato.git', '')).toThrow(
      'Remote branch is required',
    );
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd tomato_app && npx vitest run tests/main/sync/repository-binding.test.ts -t parseRemoteBinding`
Expected: FAIL because `parseRemoteBinding` does not exist yet or still enforces GitHub-only parsing.

- [ ] **Step 3: Implement the minimal generic binding model**

```typescript
export interface RepositoryBinding {
  remoteUrl: string;
  remoteLabel: string;
  remoteBranch: string;
  boundAt: string;
  updatedAt: string;
}

export interface ParsedRepositoryBinding {
  remoteUrl: string;
  remoteLabel: string;
  remoteBranch: string;
}

export function parseRemoteBinding(remoteUrl: string, remoteBranch: string): ParsedRepositoryBinding {
  const trimmedUrl = remoteUrl.trim();
  const trimmedBranch = remoteBranch.trim();

  if (!trimmedUrl) {
    throw new Error('Remote URL is required');
  }

  if (!trimmedBranch) {
    throw new Error('Remote branch is required');
  }

  return {
    remoteUrl: trimmedUrl,
    remoteLabel: trimmedUrl,
    remoteBranch: trimmedBranch,
  };
}

export function createRepositoryBinding(remoteUrl: string, remoteBranch: string, now: Date = new Date()): RepositoryBinding {
  const parsed = parseRemoteBinding(remoteUrl, remoteBranch);
  const timestamp = now.toISOString();

  return {
    ...parsed,
    boundAt: timestamp,
    updatedAt: timestamp,
  };
}
```

- [ ] **Step 4: Run the test again and confirm it passes**

Run: `cd tomato_app && npx vitest run tests/main/sync/repository-binding.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the binding-model refactor**

```bash
git add tomato_app/src/main/sync/repository-binding.ts tomato_app/tests/main/sync/repository-binding.test.ts
git commit -m "feat: generalize sync binding model"
```

---

### Task 2: Rebuild the main-process sync service for local-first flow

**Files:**
- Modify: `tomato_app/src/main/sync/git-credentials.ts`
- Modify: `tomato_app/src/main/sync/sync-service.ts`
- Modify: `tomato_app/tests/main/sync/sync-service.test.ts`

- [ ] **Step 1: Write failing tests for login-free binding and local-first sync**

```typescript
test('bindRepository stores binding metadata and pushes an empty remote without OAuth', async () => {
  const service = new SyncService({
    bindingStore,
    gitFactory,
    syncManagerFactory,
    storage: {} as any,
    dataDirProvider: () => '/tmp/tomato-data',
  } as any);

  const result = await service.bindRepository('https://example.com/team/tomato.git', 'main');

  expect(gitFactory).toHaveBeenCalledWith(
    '/tmp/tomato-data',
    expect.objectContaining({
      remoteName: 'origin',
      remoteBranch: 'main',
      env: undefined,
    }),
  );
  expect(result).toEqual({ success: true, status: 'synced' });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd tomato_app && npx vitest run tests/main/sync/sync-service.test.ts -t bindRepository`
Expected: FAIL because the current service still expects GitHub login/token state.

- [ ] **Step 3: Implement the minimal local-first service behavior**

```typescript
// key behavior only; keep current class shape if possible
async bindRepository(remoteUrl: string, remoteBranch: string): Promise<SyncResult> {
  const binding = createRepositoryBinding(remoteUrl, remoteBranch);
  const remoteName = 'origin';
  await this.ensureRuntime(binding, undefined, { prepareBranch: true });
  await this.bindingStore.saveBinding(binding);

  const remoteHasContent = Boolean(await this.syncGit.getRemoteDefaultBranch(remoteName));
  if (!remoteHasContent) {
    return this.pushEmptyRemote(binding);
  }

  return this.sync();
}

async sync(): Promise<SyncResult> {
  const binding = await this.ensureRuntime();
  await this.syncManager?.commitChanges('sync: local changes before merge');
  const pullResult = await this.syncManager?.pullChanges();
  if (pullResult?.status === 'conflict') {
    this.syncStatus = 'conflict';
    return pullResult;
  }
  return this.syncManager?.pushChanges() ?? { success: false, status: 'error', error: 'Sync manager not initialized' };
}
```

- [ ] **Step 4: Remove OAuth/token handling from the service and credential helper**

```typescript
export function createGitCredentialEnv(): NodeJS.ProcessEnv | undefined {
  return undefined;
}
```

- [ ] **Step 5: Run the main sync tests**

Run: `cd tomato_app && npx vitest run tests/main/sync/sync-service.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the service refactor**

```bash
git add tomato_app/src/main/sync/git-credentials.ts tomato_app/src/main/sync/sync-service.ts tomato_app/tests/main/sync/sync-service.test.ts
git commit -m "feat: rebuild sync service for local-first remote sync"
```

---

### Task 3: Update IPC and preload bridges for the new sync contract

**Files:**
- Modify: `tomato_app/src/shared/ipc-channels.ts`
- Modify: `tomato_app/src/preload/index.ts`
- Modify: `tomato_app/src/main/ipc-handlers.ts`

- [ ] **Step 1: Update the contract tests through the type system**

```typescript
// in IpcChannelMap
[IPC.SYNC_BIND_REPOSITORY]: { request: { repositoryUrl: string; repositoryBranch: string }; response: SyncResult };
[IPC.SYNC_LOGIN]: never;
[IPC.SYNC_LOGOUT]: never;
```

- [ ] **Step 2: Run a type check to expose all old login callers**

Run: `cd tomato_app && npx tsc --noEmit`
Expected: FAIL with references to `sync:login`, `sync:logout`, and the old one-argument bind flow.

- [ ] **Step 3: Remove the obsolete sync bridge methods and expose the new bind signature**

```typescript
sync: {
  bindRepository: (repositoryUrl: string, repositoryBranch: string) =>
    ipcRenderer.invoke(SYNC.BIND_REPOSITORY, { repositoryUrl, repositoryBranch }),
  unbindRepository: () => ipcRenderer.invoke(SYNC.UNBIND_REPOSITORY),
  getStatus: () => ipcRenderer.invoke(SYNC.GET_STATUS),
  sync: () => ipcRenderer.invoke(SYNC.SYNC),
  resolveConflict: () => ipcRenderer.invoke(SYNC.RESOLVE_CONFLICT),
  rollback: () => ipcRenderer.invoke(SYNC.ROLLBACK),
  getDataDir: () => ipcRenderer.invoke(SYNC.GET_DATA_DIR),
},
```

- [ ] **Step 4: Wire the main-process handler to the new payload shape**

```typescript
ipcMain.handle(IPC.SYNC_BIND_REPOSITORY, async (_event, payload: { repositoryUrl: string; repositoryBranch: string }) => {
  return syncService.bindRepository(payload.repositoryUrl, payload.repositoryBranch);
});
```

- [ ] **Step 5: Re-run the type check**

Run: `cd tomato_app && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit the bridge update**

```bash
git add tomato_app/src/shared/ipc-channels.ts tomato_app/src/preload/index.ts tomato_app/src/main/ipc-handlers.ts
git commit -m "feat: update sync ipc contract"
```

---

### Task 4: Rework the renderer sync store and settings UI

**Files:**
- Modify: `tomato_app/src/renderer/stores/sync-store.ts`
- Modify: `tomato_app/src/renderer/components/Sync/RepositoryField.tsx`
- Modify: `tomato_app/src/renderer/components/Sync/SyncSettings.tsx`
- Modify: `tomato_app/src/renderer/components/Sync/SyncBindingStatus.tsx`
- Modify: `tomato_app/src/renderer/components/Sync/SyncStatus.tsx`
- Modify: `tomato_app/src/renderer/components/Sync/ConflictPrompt.tsx`
- Modify: `tomato_app/tests/stores/sync-store.test.ts`

- [ ] **Step 1: Write failing store tests for branch-aware binding and login-free state**

```typescript
test('bindRepository forwards remote url and branch', async () => {
  syncApi.bindRepository.mockResolvedValue({ success: true, status: 'synced' });
  syncApi.getStatus.mockResolvedValue({
    ...baseStatus,
    isBound: true,
    repositoryUrl: 'https://example.com/team/tomato.git',
    remoteLabel: 'https://example.com/team/tomato.git',
    remoteBranch: 'main',
    syncStatus: 'synced',
  });

  await useSyncStore.getState().bindRepository('https://example.com/team/tomato.git', 'main');

  expect(syncApi.bindRepository).toHaveBeenCalledWith('https://example.com/team/tomato.git', 'main');
});
```

- [ ] **Step 2: Run the store tests and confirm they fail**

Run: `cd tomato_app && npx vitest run tests/stores/sync-store.test.ts`
Expected: FAIL because the store still tracks login/logout and a one-argument bind call.

- [ ] **Step 3: Remove login/logout state from the store and add branch-aware bind state**

```typescript
interface SyncState {
  status: SyncStatus;
  isBound: boolean;
  repositoryUrl: string | null;
  remoteLabel: string | null;
  remoteBranch: string | null;
  boundAt: string | null;
  updatedAt: string | null;
  lastSyncTime: string | null;
  error: string | null;
  conflictBranch: string | null;
  dataDir: string | null;
}

bindRepository: async (repositoryUrl: string, remoteBranch: string) => {
  const result = await getSyncBridge().bindRepository(repositoryUrl, remoteBranch);
  // refresh from getStatus on success; set conflict or error states otherwise
},
```

- [ ] **Step 4: Rework the settings components for remote + branch input**

```typescript
<RepositoryField
  remoteUrl={remoteUrl}
  remoteBranch={remoteBranch}
  onRemoteUrlChange={setRemoteUrl}
  onRemoteBranchChange={setRemoteBranch}
  onSubmit={handleBind}
  disabled={status === 'syncing'}
/>
```

```typescript
export function SyncSettings() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        请先在本机完成 Git 认证，例如使用 gh auth login、SSH key 或 Git Credential Manager，然后再绑定仓库。
      </p>
      <RepositoryField
        remoteUrl={remoteUrl}
        remoteBranch={remoteBranch}
        onRemoteUrlChange={setRemoteUrl}
        onRemoteBranchChange={setRemoteBranch}
        onSubmit={handleBind}
        disabled={status === 'syncing'}
      />
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      <SyncBindingStatus />
      <SyncStatus />
    </div>
  );
}
```

- [ ] **Step 5: Update the conflict prompt to describe the single recovery path**

```typescript
<p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
  当前冲突已保留本地分支和工作区。请先在本地手动处理冲突，再点击“手动处理后继续同步”。
</p>
```

- [ ] **Step 6: Run the store and renderer-focused tests**

Run: `cd tomato_app && npx vitest run tests/stores/sync-store.test.ts`
Expected: PASS

- [ ] **Step 7: Commit the renderer refactor**

```bash
git add tomato_app/src/renderer/stores/sync-store.ts tomato_app/src/renderer/components/Sync/RepositoryField.tsx tomato_app/src/renderer/components/Sync/SyncSettings.tsx tomato_app/src/renderer/components/Sync/SyncBindingStatus.tsx tomato_app/src/renderer/components/Sync/SyncStatus.tsx tomato_app/src/renderer/components/Sync/ConflictPrompt.tsx tomato_app/tests/stores/sync-store.test.ts
git commit -m "feat: refactor sync settings for remote and branch binding"
```

---

### Task 5: Update acceptance tests and remove GitHub-specific E2E assumptions

**Files:**
- Modify: `tomato_app/tests/e2e/basic-acceptance-sync.spec.ts`
- Modify: `tomato_app/tests/e2e/helpers/acceptance-helpers.ts`

- [ ] **Step 1: Write failing E2E assertions for the new settings form**

```typescript
test('绑定仓库状态可见，解绑后恢复未绑定状态', async ({ page }) => {
  await seedSyncBinding(page, {
    repositoryUrl: 'https://example.com/team/tomato.git',
    remoteLabel: 'https://example.com/team/tomato.git',
    remoteBranch: 'main',
    isBound: true,
    syncStatus: 'synced',
    lastSyncTime: '2026-05-14T09:00:00.000Z',
    boundAt: '2026-05-14T08:00:00.000Z',
    updatedAt: '2026-05-14T09:00:00.000Z',
  });

  await page.getByRole('tab', { name: '设置' }).click();
  await expect(page.getByText('https://example.com/team/tomato.git')).toBeVisible();
  await expect(page.getByText('main')).toBeVisible();
});
```

- [ ] **Step 2: Run the E2E test and confirm it fails**

Run: `cd tomato_app && npm run test:e2e -- tests/e2e/basic-acceptance-sync.spec.ts`
Expected: FAIL because the UI still expects GitHub-centric labels and the seed payload still mirrors the old binding shape.

- [ ] **Step 3: Update the acceptance helpers to seed the new binding payload**

```typescript
export async function seedSyncBinding(
  page: Page,
  state: {
    isBound?: boolean;
    repositoryUrl?: string | null;
    remoteLabel?: string | null;
    remoteBranch?: string | null;
    boundAt?: string | null;
    updatedAt?: string | null;
    syncStatus?: 'idle' | 'syncing' | 'synced' | 'conflict' | 'offline' | 'error';
    lastSyncTime?: string | null;
    error?: string | null;
    conflictBranch?: string | null;
  },
): Promise<void> {
  return page.evaluate(async ({ channel, payload }) => {
    return window.electronAPI.invoke(channel as never, payload as never);
  }, { channel: IPC.TEST_SYNC_SEED, payload: state });
}
```

- [ ] **Step 4: Rework the E2E assertions for remote + branch + conflict recovery**

```typescript
await expect(page.getByText('https://example.com/team/tomato.git')).toBeVisible();
await expect(page.getByText('main')).toBeVisible();
await expect(page.getByRole('button', { name: '验证并连接' })).toBeVisible();
await expect(page.getByRole('button', { name: '解绑' })).toBeVisible();
```

- [ ] **Step 5: Re-run the acceptance test**

Run: `cd tomato_app && npm run test:e2e -- tests/e2e/basic-acceptance-sync.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit the E2E updates**

```bash
git add tomato_app/tests/e2e/basic-acceptance-sync.spec.ts tomato_app/tests/e2e/helpers/acceptance-helpers.ts
git commit -m "test: update sync acceptance coverage"
```

---

### Task 6: End-to-end verification and cleanup

**Files:**
- Inspect: all files modified in Tasks 1-5

- [ ] **Step 1: Run the targeted unit test suite**

Run: `cd tomato_app && npx vitest run tests/main/sync/repository-binding.test.ts tests/main/sync/sync-service.test.ts tests/stores/sync-store.test.ts`
Expected: PASS

- [ ] **Step 2: Run the targeted E2E suite**

Run: `cd tomato_app && npm run test:e2e -- tests/e2e/basic-acceptance-sync.spec.ts`
Expected: PASS

- [ ] **Step 3: Run a full type check**

Run: `cd tomato_app && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run the workspace build if sync main-process code changed**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Review the spec coverage against the implementation**

Check that the final code covers:

```text
- remote binding without OAuth
- manual branch selection
- empty remote first push
- non-empty remote fetch + merge
- conflict preservation and recovery
- settings UI state and error display
```

- [ ] **Step 6: Commit the final verification pass if any small fixes were needed**

```bash
git add -A
git commit -m "chore: verify local-first sync refactor"
```

---

## Self-Review

### 1. Spec coverage

- Remote binding without OAuth: Tasks 1-3
- Manual branch selection: Tasks 1-2 and 4-5
- Empty remote first push: Task 2
- Non-empty remote fetch + merge: Task 2
- Conflict preservation and recovery: Tasks 2 and 4
- Settings UI and error display: Task 4
- E2E acceptance updates: Task 5

### 2. Placeholder scan

No TBD/TODO placeholders remain. Every task has concrete file paths, commands, and code snippets.

### 3. Type consistency

- `RepositoryBinding` is reduced to `remoteUrl`, `remoteLabel`, `remoteBranch`, `boundAt`, and `updatedAt`
- `bindRepository(remoteUrl, remoteBranch)` is used consistently across main, preload, store, and tests
- The E2E seed payload matches the new binding model and no longer references GitHub owner/name fields
