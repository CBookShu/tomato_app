import fs from 'node:fs/promises';
import path from 'node:path';
import { launchElectronApp, test, expect } from './fixtures';
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

  test('relaunch 后会从 tomato-data/.meta 恢复同步绑定并迁移 legacy 文件', async ({
    electronApp,
    userDataDir,
  }) => {
    const binding = {
      remoteUrl: 'https://example.com/team/tomato.git',
      remoteLabel: 'https://example.com/team/tomato.git',
      remoteBranch: 'main',
      boundAt: '2026-05-14T08:00:00.000Z',
      updatedAt: '2026-05-14T08:05:00.000Z',
    };
    const legacyPath = path.join(userDataDir, 'repository-binding.json');
    const bindingPath = path.join(userDataDir, 'tomato-data', '.meta', 'repository-binding.json');

    await electronApp.close();
    await fs.mkdir(path.dirname(legacyPath), { recursive: true });
    await fs.writeFile(legacyPath, `${JSON.stringify(binding, null, 2)}\n`, 'utf8');

    const relaunchApp = await launchElectronApp(userDataDir);
    const relaunchPage = await relaunchApp.firstWindow();
    await relaunchPage.waitForLoadState('domcontentloaded');

    try {
      await relaunchPage.getByRole('tab', { name: '设置' }).click();

      await expect(relaunchPage.getByLabel('远程地址')).toHaveValue(binding.remoteUrl);
      await expect(relaunchPage.getByLabel('目标分支')).toHaveValue(binding.remoteBranch);
      await expect(relaunchPage.getByText('已绑定', { exact: true })).toBeVisible();
      await expect(fs.readFile(bindingPath, 'utf8')).resolves.toContain('"remoteBranch": "main"');
      await expect(fs.access(legacyPath)).rejects.toThrow();
    } finally {
      await relaunchApp.close().catch(() => {});
    }
  });
});
