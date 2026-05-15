import { test, expect } from './fixtures';
import { clearDataAndReload, seedSyncBinding } from './helpers/acceptance-helpers';

test.describe('基础验收：同步绑定', () => {
  test.beforeEach(async ({ page, electronApp }) => {
    await clearDataAndReload(page, electronApp);
  });

  test('绑定仓库状态可见，解绑后恢复未绑定状态', async ({ page }) => {
    await seedSyncBinding(page, {
      repositoryUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
      syncStatus: 'synced',
      lastSyncTime: '2026-05-14T09:00:00.000Z',
      boundAt: '2026-05-14T08:00:00.000Z',
      updatedAt: '2026-05-14T09:00:00.000Z',
    });

    await page.getByRole('tab', { name: '设置' }).click();

    await expect(page.getByLabel('远程地址')).toHaveValue('https://example.com/team/tomato.git');
    await expect(page.getByLabel('目标分支')).toHaveValue('main');
    await expect(page.getByText('已绑定', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '绑定远程' })).toBeVisible();
    await expect(page.getByRole('button', { name: '解绑' })).toBeVisible();

    await page.getByRole('button', { name: '解绑' }).click();

    await expect(page.getByText('未绑定', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '解绑' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '绑定远程' })).toBeVisible();
    await expect(page.getByLabel('远程地址')).toHaveValue('');
    await expect(page.getByLabel('目标分支')).toHaveValue('');
  });

  test('冲突状态展示备份分支，手动处理后恢复同步', async ({ page }) => {
    await seedSyncBinding(page, {
      repositoryUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
      syncStatus: 'conflict',
      conflictBranch: 'local-backup-20260514-090000-abc12345',
      lastSyncTime: '2026-05-14T09:00:00.000Z',
      boundAt: '2026-05-14T08:00:00.000Z',
      updatedAt: '2026-05-14T09:00:00.000Z',
    });

    await page.getByRole('tab', { name: '设置' }).click();

    await expect(page.getByLabel('远程地址')).toHaveValue('https://example.com/team/tomato.git');
    await expect(page.getByLabel('目标分支')).toHaveValue('main');
    await expect(page.getByText('有冲突', { exact: true })).toBeVisible();
    await expect(page.locator('div').filter({ hasText: /^local-backup-20260514-090000-abc12345$/ }).last()).toBeVisible();
    await expect(page.getByText('处理顺序很简单：')).toBeVisible();
    await expect(page.getByText('git status')).toBeVisible();
    await expect(page.getByRole('button', { name: '手动处理后继续同步' })).toBeVisible();

    await page.getByRole('button', { name: '手动处理后继续同步' }).click();
    await expect(page.getByRole('button', { name: '手动处理后继续同步' })).toHaveCount(0);
  });
});
