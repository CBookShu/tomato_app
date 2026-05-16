import { test, expect } from './fixtures';
import { clearDataAndReload, createDefaultTask, fastForwardTimer, waitForMainTimerToStart } from './helpers/acceptance-helpers';

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
    await waitForMainTimerToStart(page);

    await fastForwardTimer(page, 5);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('tab', { name: '统计' }).click();
    await expect(page.getByTestId('daily-stat-pomodoros')).toHaveText('1');
  });

  test('手动完成任务后，统计页应立即刷新完成任务数', async ({ page }) => {
    const taskItem = await createDefaultTask(page, '验收任务：手动完成刷新');

    await page.getByRole('tab', { name: '统计' }).click();
    await expect(page.getByTestId('daily-stat-completed-tasks')).toHaveText('0');

    await page.getByRole('tab', { name: '任务' }).click();
    await taskItem.locator('label').click();

    await page.getByRole('tab', { name: '统计' }).click();
    await expect(page.getByTestId('daily-stat-completed-tasks')).toHaveText('1');
  });
});
