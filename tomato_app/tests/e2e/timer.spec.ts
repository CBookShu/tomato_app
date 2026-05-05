import { test, expect } from './fixtures';

test.describe('Timer', () => {
  test('displays idle state on load', async ({ page }) => {
    await expect(page.locator('text=准备开始')).toBeVisible();
  });

  test('shows timer display with 00:00 initially', async ({ page }) => {
    await expect(page.locator('text=00:00')).toBeVisible();
  });

  test('has start button when idle', async ({ page }) => {
    await expect(page.locator('button:has-text("开始专注")')).toBeVisible();
  });

  test('bottom tab bar has all 4 tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: '计时' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '任务' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '统计' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '设置' })).toBeVisible();
  });

  test('clicking tasks tab shows task list', async ({ page }) => {
    await page.getByRole('tab', { name: '任务' }).click();
    await expect(page.locator('button:has-text("新建分组")')).toBeVisible();
  });

  test('clicking stats tab shows stats cards', async ({ page }) => {
    await page.getByRole('tab', { name: '统计' }).click();
    await expect(page.locator('text=今日统计')).toBeVisible();
    await expect(page.locator('text=本周趋势')).toBeVisible();
  });

  test('clicking settings tab shows settings', async ({ page }) => {
    await page.getByRole('tab', { name: '设置' }).click();
    await expect(page.locator('text=计时设置')).toBeVisible();
    await expect(page.locator('text=通知设置')).toBeVisible();
  });
});
