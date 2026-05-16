import { test, expect } from './fixtures';

test.describe('窗口标题栏', () => {
  test('标题栏应可拖动并支持双击最大化', async ({ page, electronApp }) => {
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('header')).toHaveCSS('-webkit-app-region', 'drag');

    const isMaximizedBefore = await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win?.isMaximized() ?? false;
    });
    expect(isMaximizedBefore).toBe(false);

    await page.locator('header').dblclick();

    const isMaximizedAfter = await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win?.isMaximized() ?? false;
    });
    expect(isMaximizedAfter).toBe(true);
  });
});
