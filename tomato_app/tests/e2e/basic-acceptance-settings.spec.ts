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

  function getNumericSetting(page: Page, label: string) {
    return page.getByText(label).locator('..').getByRole('spinbutton');
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
    await pomodoroInput.press('Enter');
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

  test('计时数字项在 blur 或 Enter 前不应写回，并会在提交后持久化', async ({ page }) => {
    await page.getByRole('tab', { name: '设置' }).click();

    const pomodoroInput = getNumericSetting(page, '番茄时长 (分钟)');
    await expect(pomodoroInput).toHaveValue('25');
    await expect(pomodoroInput).toHaveJSProperty('type', 'number');

    await pomodoroInput.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('30');
    await expect(pomodoroInput).toHaveValue('30');

    await page.waitForTimeout(200);
    expect((await readSettings(page)).pomodoroDuration).toBe('25');

    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readSettings(page)).pomodoroDuration).toBe('30');

    const shortBreakInput = getNumericSetting(page, '短休息 (分钟)');
    await shortBreakInput.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('8');
    await expect(shortBreakInput).toHaveValue('8');

    await page.waitForTimeout(200);
    expect((await readSettings(page)).shortBreakDuration).toBe('5');

    await shortBreakInput.blur();
    await expect.poll(async () => (await readSettings(page)).shortBreakDuration).toBe('8');
  });

  test('计时数字项在空值或非法值提交时应恢复到上一次合法值', async ({ page }) => {
    await page.getByRole('tab', { name: '设置' }).click();

    const longBreakInput = getNumericSetting(page, '长休息 (分钟)');
    await expect(longBreakInput).toHaveValue('15');
    await longBreakInput.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('18');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readSettings(page)).longBreakDuration).toBe('18');

    await longBreakInput.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await expect(longBreakInput).toHaveValue('');
    await longBreakInput.blur();
    await expect(longBreakInput).toHaveValue('18');
    expect((await readSettings(page)).longBreakDuration).toBe('18');

    const longBreakIntervalInput = getNumericSetting(page, '长休息间隔 (番茄数)');
    await expect(longBreakIntervalInput).toHaveValue('4');
    await longBreakIntervalInput.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('0');
    await expect(longBreakIntervalInput).toHaveValue('0');
    await page.keyboard.press('Enter');
    await expect(longBreakIntervalInput).toHaveValue('4');
    expect((await readSettings(page)).longBreakInterval).toBe('4');
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
