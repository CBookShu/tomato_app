import { test, expect } from './fixtures';

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await page.click('text=任务');
  });

  test('shows new group button', async ({ page }) => {
    await expect(page.locator('button:has-text("新建分组")')).toBeVisible();
  });
});
