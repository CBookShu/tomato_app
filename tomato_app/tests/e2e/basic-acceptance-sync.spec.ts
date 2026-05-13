import { test, expect } from './fixtures';
import { clearDataAndReload, seedSyncBinding } from './helpers/acceptance-helpers';

test.describe('基础验收：同步绑定', () => {
  test.beforeEach(async ({ page, electronApp }) => {
    await clearDataAndReload(page, electronApp);
  });

  test('绑定仓库状态可见，解绑后恢复未绑定状态', async ({ page }) => {
    await seedSyncBinding(page, {
      repositoryUrl: 'https://github.com/you/tomato-data',
      repositoryOwner: 'you',
      repositoryName: 'tomato-data',
      remoteName: 'origin',
      remoteBranch: 'main',
      isBound: true,
      isLoggedIn: true,
      syncStatus: 'synced',
      lastSyncTime: '2026-05-14T09:00:00.000Z',
      boundAt: '2026-05-14T08:00:00.000Z',
      updatedAt: '2026-05-14T09:00:00.000Z',
    });

    await page.getByRole('tab', { name: '设置' }).click();

    await expect(page.getByText('you/tomato-data')).toBeVisible();
    await expect(page.getByText('origin/main')).toBeVisible();
    await expect(page.getByRole('button', { name: '解绑仓库' })).toBeVisible();

    await page.getByRole('button', { name: '解绑仓库' }).click();

    await expect(page.getByText('未绑定仓库')).toBeVisible();
    await expect(page.getByRole('button', { name: '解绑仓库' })).toHaveCount(0);
    await expect(page.getByPlaceholder('https://github.com/owner/repo')).toHaveValue('');
  });

  test('冲突状态展示备份分支和处理动作', async ({ page }) => {
    await seedSyncBinding(page, {
      repositoryUrl: 'https://github.com/you/tomato-data',
      repositoryOwner: 'you',
      repositoryName: 'tomato-data',
      remoteName: 'origin',
      remoteBranch: 'main',
      isBound: true,
      isLoggedIn: true,
      syncStatus: 'conflict',
      conflictBranch: 'local-backup-20260514-090000-abc12345',
      lastSyncTime: '2026-05-14T09:00:00.000Z',
      boundAt: '2026-05-14T08:00:00.000Z',
      updatedAt: '2026-05-14T09:00:00.000Z',
    });

    await page.getByRole('tab', { name: '设置' }).click();

    await expect(page.getByText('local-backup-20260514-090000-abc12345')).toBeVisible();
    await expect(page.getByRole('button', { name: '回滚到远程版本' })).toBeVisible();
    await expect(page.getByRole('button', { name: '手动处理后继续同步' })).toBeVisible();

    await page.getByRole('button', { name: '回滚到远程版本' }).click();
    await expect(page.getByRole('button', { name: '回滚到远程版本' })).toHaveCount(0);
  });
});
