import { test, expect } from './fixtures';
import { clearDataAndReload, seedUpdateRelease } from './helpers/acceptance-helpers';
import { IPC } from '../../src/shared/ipc-channels.js';
import type { Page } from '@playwright/test';

test.describe('基础验收：设置持久化', () => {
  test.beforeEach(async ({ page, electronApp }) => {
    await clearDataAndReload(page, electronApp);
  });

  async function readSettings(page: Page) {
    return page.evaluate(async ({ settingsGetAllChannel }) => {
      return window.electronAPI.invoke(settingsGetAllChannel);
    }, { settingsGetAllChannel: IPC.SETTINGS_GET_ALL });
  }

  test('修改番茄时长与暗色模式后，刷新应保留', async ({ page }) => {
    await page.getByRole('tab', { name: '设置' }).click();

    const pomodoroSetting = page.getByText('番茄时长 (分钟)').locator('..');
    const pomodoroInput = pomodoroSetting.getByRole('spinbutton');
    await pomodoroInput.fill('30');

    const darkModeSetting = page.getByText('暗色模式').locator('..');
    const darkModeCheckbox = darkModeSetting.locator('input[type="checkbox"]');
    if (!(await darkModeCheckbox.isChecked())) {
      await darkModeCheckbox.locator('..').click();
    }
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect.poll(async () => {
      const persisted = await readSettings(page);
      return persisted.pomodoroDuration;
    }).toBe('30');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: '设置' }).click();

    const pomodoroSettingAfterReload = page.getByText('番茄时长 (分钟)').locator('..');
    await expect(pomodoroSettingAfterReload.getByRole('spinbutton')).toHaveValue('30');
    const darkModeSettingAfterReload = page.getByText('暗色模式').locator('..');
    await expect(darkModeSettingAfterReload.locator('input[type="checkbox"]')).toBeChecked();
    await expect(page.locator('html')).toHaveClass(/dark/);

    const persistedSettings = await readSettings(page);
    expect(persistedSettings.pomodoroDuration).toBe('30');
  });

  test('legacy key 会被忽略，界面只读取 canonical key', async ({ page }) => {
    await page.evaluate(async ({ settingsSetChannel }) => {
      await window.electronAPI.invoke(settingsSetChannel, { key: 'pomodoro_duration', value: '31' });
    }, { settingsSetChannel: IPC.SETTINGS_SET });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: '设置' }).click();

    const pomodoroSetting = page.getByText('番茄时长 (分钟)').locator('..');
    const pomodoroInput = pomodoroSetting.getByRole('spinbutton');
    await expect(pomodoroInput).toHaveValue('25');

    await pomodoroInput.fill('32');
    await expect.poll(async () => {
      const persisted = await readSettings(page);
      return {
        pomodoroDuration: persisted.pomodoroDuration,
        pomodoro_duration: persisted.pomodoro_duration ?? null,
      };
    }).toEqual({
      pomodoroDuration: '32',
      pomodoro_duration: '31',
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: '设置' }).click();
    await expect(page.getByText('番茄时长 (分钟)').locator('..').getByRole('spinbutton')).toHaveValue('32');

    const persistedSettings = await readSettings(page);
    expect(persistedSettings.pomodoroDuration).toBe('32');
    expect(persistedSettings.pomodoro_duration).toBe('31');
  });

  test('设置页显示软件更新区块，种子化发布会显示为可用更新', async ({ page }) => {
    await seedUpdateRelease(page, {
      latestVersion: '0.2.0',
      releaseTag: 'v0.2.0',
      releaseName: 'Tomato 0.2.0',
      releaseUrl: 'https://github.com/CBookShu/tomato_app/releases/tag/v0.2.0',
      releaseNotes: '## Highlights',
      lastCheckedAt: '2026-05-16T08:10:00.000Z',
    });

    await page.getByRole('tab', { name: '设置' }).click();

    await expect(page.getByText('软件更新')).toBeVisible();
    await expect(page.getByText('发现新版本')).toBeVisible();
    await expect(page.getByText('0.2.0 (v0.2.0)', { exact: true })).toBeVisible();
    await expect(page.getByText('v0.2.0', { exact: true })).toBeVisible();
    await expect(page.getByText('Tomato 0.2.0')).toBeVisible();
    await expect(page.getByRole('button', { name: '打开发布页' })).toBeVisible();
  });
});
