import { test, expect } from './fixtures';
import { clearDataAndReload } from './helpers/acceptance-helpers';

test.describe('基础验收：设置持久化（RED）', () => {
  test.beforeEach(async ({ page, electronApp }) => {
    await clearDataAndReload(page, electronApp);
  });

  test('修改番茄时长与暗色模式后，刷新应保留（RED）', async ({ page }) => {
    await page.getByRole('tab', { name: '设置' }).click();

    const pomodoroInput = page.locator('label:has-text("番茄时长")').locator('..').getByRole('spinbutton');
    await pomodoroInput.fill('30');

    const darkModeRow = page.locator('div.flex.items-center.justify-between').filter({
      has: page.getByText('暗色模式'),
    }).first();
    const darkModeCheckbox = darkModeRow.locator('input[type="checkbox"]');
    if (!(await darkModeCheckbox.isChecked())) {
      await darkModeRow.locator('label').nth(1).click();
    }
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: '设置' }).click();

    // RED: 持久化断言故意不匹配，确保当前阶段失败
    await expect(page.locator('label:has-text("番茄时长")').locator('..').getByRole('spinbutton')).toHaveValue('31');
    const darkModeRowAfterReload = page.locator('div.flex.items-center.justify-between').filter({
      has: page.getByText('暗色模式'),
    }).first();
    await expect(darkModeRowAfterReload.locator('input[type="checkbox"]')).toBeChecked();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
