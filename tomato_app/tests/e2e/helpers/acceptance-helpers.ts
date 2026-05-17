import { ElectronApplication, Locator, Page } from '@playwright/test';
import { expect } from '../fixtures';
import { IPC } from '../../../src/shared/ipc-channels.js';

const RESET_SYNC_STATE = {
  repositoryUrl: null,
  remoteLabel: null,
  remoteBranch: null,
  boundAt: null,
  updatedAt: null,
  syncStatus: 'idle',
  lastSyncTime: null,
  error: null,
  conflictBranch: null,
} as const;

export async function clearDataAndReload(page: Page, electronApp: ElectronApplication): Promise<void> {
  void electronApp;
  await page.waitForLoadState('domcontentloaded');
  const clearResult = await page.evaluate(async () => {
    try {
      return await window.electronAPI.invoke('test:clear-database');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`test:clear-database handler is unavailable: ${message}`);
    }
  });
  if (!clearResult?.success) {
    throw new Error('test:clear-database did not return success');
  }
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  const resetResult = await page.evaluate(async ({ channel, payload }) => {
    try {
      return await window.electronAPI.invoke(channel as never, payload as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`test:seed-sync handler is unavailable: ${message}`);
    }
  }, { channel: IPC.TEST_SYNC_SEED, payload: RESET_SYNC_STATE });

  if (!resetResult?.success) {
    throw new Error('test:seed-sync did not return success');
  }

  await resetUpdateState(page);
}

export async function seedSyncBinding(
  page: Page,
  state: {
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
  const result = await page.evaluate(async ({ channel, payload }) => {
    try {
      return await window.electronAPI.invoke(channel as never, payload as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`test:seed-sync handler is unavailable: ${message}`);
    }
  }, { channel: IPC.TEST_SYNC_SEED, payload: state });

  if (!result?.success) {
    throw new Error('test:seed-sync did not return success');
  }
}

export async function seedUpdateRelease(
  page: Page,
  state: {
    status?: 'idle' | 'available' | 'up-to-date' | 'error';
    latestVersion?: string | null;
    releaseTag?: string | null;
    releaseName?: string | null;
    releaseUrl?: string | null;
    releaseNotes?: string | null;
    lastCheckedAt?: string | null;
    error?: string | null;
  },
): Promise<void> {
  const result = await page.evaluate(async ({ channel, payload }) => {
    try {
      return await window.electronAPI.invoke(channel as never, payload as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`test:update-seed handler is unavailable: ${message}`);
    }
  }, { channel: IPC.TEST_UPDATE_SEED, payload: state });

  if (!result?.success) {
    throw new Error('test:update-seed did not return success');
  }
}

export async function resetUpdateState(page: Page): Promise<void> {
  const result = await page.evaluate(async ({ channel }) => {
    try {
      return await window.electronAPI.invoke(channel as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`test:update-reset handler is unavailable: ${message}`);
    }
  }, { channel: IPC.TEST_UPDATE_RESET });

  if (!result?.success) {
    throw new Error('test:update-reset did not return success');
  }
}

export async function fastForwardTimer(page: Page, seconds: number): Promise<void> {
  const result = await page.evaluate(async (forwardSeconds) => {
    try {
      return await window.electronAPI.invoke('test:fast-forward', forwardSeconds);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`test:fast-forward handler is unavailable: ${message}`);
    }
  }, seconds);

  if (!result?.success) {
    throw new Error('test:fast-forward did not return success');
  }
}

export async function waitForMainTimerToStart(page: Page): Promise<void> {
  await expect.poll(async () => {
    return page.evaluate(async () => {
      const state = await window.electronAPI.invoke('timer:state');
      return Boolean(state?.status === 'working' && state?.currentTaskId);
    });
  }).toBe(true);
}

export async function createDefaultTask(page: Page, title = '新任务'): Promise<Locator> {
  await page.getByRole('tab', { name: '任务' }).click();
  await expect(page.getByText('未分组')).toBeVisible();

  await page.getByRole('button', { name: '新建任务' }).click();
  const newTaskItem = page.getByTestId('task-item').filter({ hasText: '新任务' }).first();
  await expect(newTaskItem).toBeVisible();

  if (title !== '新任务') {
    await newTaskItem.hover();
    await newTaskItem.locator('button').last().click();
    await newTaskItem.getByRole('button', { name: '编辑' }).click();

    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(title);
    await page.keyboard.press('Enter');
  }

  const taskItem = page.getByTestId('task-item').filter({ hasText: title }).first();
  await expect(taskItem).toBeVisible();
  return taskItem;
}
