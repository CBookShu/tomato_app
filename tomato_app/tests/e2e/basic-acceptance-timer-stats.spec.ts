import { test, expect } from './fixtures';
import { clearDataAndReload, createDefaultTask } from './helpers/acceptance-helpers';

test.describe('基础验收：计时与统计联动', () => {
  test.beforeEach(async ({ page, electronApp }) => {
    await clearDataAndReload(page, electronApp);
  });

  test('从任务菜单开始专注后，任务页与计时状态应正确联动', async ({ page }) => {
    const taskItem = await createDefaultTask(page, '验收任务：番茄统计');

    await taskItem.hover();
    await taskItem.locator('button').last().click();
    await page.getByText('开始专注').click();

    await expect(page.getByRole('tab', { name: '任务', selected: true })).toBeVisible();
    await expect(taskItem.getByTestId('timer-indicator')).toBeVisible();

    await page.getByRole('tab', { name: '计时' }).click();
    await expect(page.getByTestId('timer-pause-button')).toBeVisible();
  });
});
