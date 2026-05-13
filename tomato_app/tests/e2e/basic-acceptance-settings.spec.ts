import { test, expect } from './fixtures';
import { clearDataAndReload } from './helpers/acceptance-helpers';
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

  test('兼容 legacy key 读取并在写入后迁移到 canonical key', async ({ page }) => {
    await page.evaluate(async ({ settingsSetChannel }) => {
      await window.electronAPI.invoke(settingsSetChannel, { key: 'pomodoroDuration', value: '25' });
      await window.electronAPI.invoke(settingsSetChannel, { key: 'pomodoro_duration', value: '31' });
    }, { settingsSetChannel: IPC.SETTINGS_SET });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: '设置' }).click();

    const pomodoroSetting = page.getByText('番茄时长 (分钟)').locator('..');
    const pomodoroInput = pomodoroSetting.getByRole('spinbutton');
    await expect(pomodoroInput).toHaveValue('31');

    await pomodoroInput.fill('32');
    await expect.poll(async () => {
      const persisted = await readSettings(page);
      return {
        pomodoroDuration: persisted.pomodoroDuration,
        pomodoro_duration: persisted.pomodoro_duration ?? null,
      };
    }).toEqual({
      pomodoroDuration: '32',
      pomodoro_duration: null,
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: '设置' }).click();
    await expect(page.getByText('番茄时长 (分钟)').locator('..').getByRole('spinbutton')).toHaveValue('32');

    const persistedSettings = await readSettings(page);
    expect(persistedSettings.pomodoroDuration).toBe('32');
    expect(persistedSettings.pomodoro_duration).toBeUndefined();
  });
});
