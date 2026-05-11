import { test, expect } from './fixtures';
import { clearDataAndReload, createDefaultTask } from './helpers/acceptance-helpers';

process.env.TZ = 'UTC';

test.describe('基础验收：计时与统计联动', () => {
  test.beforeEach(async ({ page, electronApp }) => {
    await clearDataAndReload(page, electronApp);
  });

  test('从任务菜单开始专注后，计时完成并在统计页展示番茄数', async ({ page }) => {
    const taskItem = await createDefaultTask(page, '验收任务：番茄统计');

    await taskItem.hover();
    await taskItem.locator('button').last().click();
    await page.getByText('开始专注').click();

    await expect(page.getByRole('tab', { name: '任务', selected: true })).toBeVisible();
    await expect(taskItem.getByTestId('timer-indicator')).toBeVisible();

    await page.getByRole('tab', { name: '计时' }).click();
    await expect(page.getByTestId('timer-pause-button')).toBeVisible();

    await expect(page.getByText('休息中')).toBeVisible({ timeout: 10000 });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('tab', { name: '统计' }).click();
    await expect(page.getByTestId('daily-stat-pomodoros')).toHaveText('1');
  });
});
