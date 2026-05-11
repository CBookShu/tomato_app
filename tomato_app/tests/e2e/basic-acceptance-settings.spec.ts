import { test, expect } from './fixtures';
import { clearDataAndReload } from './helpers/acceptance-helpers';

test.describe('基础验收：设置持久化（RED）', () => {
  test.beforeEach(async ({ page, electronApp }) => {
    await clearDataAndReload(page, electronApp);
  });

  test('修改番茄时长与暗色模式后，刷新应保留（RED）', async ({ page }) => {
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

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: '设置' }).click();

    const pomodoroSettingAfterReload = page.getByText('番茄时长 (分钟)').locator('..');
    await expect(pomodoroSettingAfterReload.getByRole('spinbutton')).toHaveValue('30');
    const darkModeSettingAfterReload = page.getByText('暗色模式').locator('..');
    await expect(darkModeSettingAfterReload.locator('input[type="checkbox"]')).toBeChecked();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
