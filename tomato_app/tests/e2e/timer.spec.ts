import { test, expect } from '@playwright/test';

test.describe('Timer', () => {
  test('displays idle state on load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=准备开始')).toBeVisible();
  });

  test('shows timer display with 00:00 initially', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=00:00')).toBeVisible();
  });

  test('has start button when idle', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('button:has-text("开始专注")')).toBeVisible();
  });

  test('bottom tab bar has all 4 tabs', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=计时')).toBeVisible();
    await expect(page.locator('text=任务')).toBeVisible();
    await expect(page.locator('text=统计')).toBeVisible();
    await expect(page.locator('text=设置')).toBeVisible();
  });

  test('clicking tasks tab shows task list', async ({ page }) => {
    await page.goto('/');
    await page.click('text=任务');
    await expect(page.locator('button:has-text("新建分组")')).toBeVisible();
  });

  test('clicking stats tab shows stats cards', async ({ page }) => {
    await page.goto('/');
    await page.click('text=统计');
    await expect(page.locator('text=今日统计')).toBeVisible();
    await expect(page.locator('text=本周趋势')).toBeVisible();
  });

  test('clicking settings tab shows settings', async ({ page }) => {
    await page.goto('/');
    await page.click('text=设置');
    await expect(page.locator('text=计时设置')).toBeVisible();
    await expect(page.locator('text=通知设置')).toBeVisible();
  });
});
