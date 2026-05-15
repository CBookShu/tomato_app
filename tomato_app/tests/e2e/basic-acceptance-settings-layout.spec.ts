import { test, expect } from './fixtures';
import { clearDataAndReload } from './helpers/acceptance-helpers';

test.describe('基础验收：设置布局', () => {
  test.beforeEach(async ({ page, electronApp }) => {
    await clearDataAndReload(page, electronApp);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('桌面宽度下设置页应保持双栏紧凑布局且按钮不换行', async ({ page }) => {
    await page.getByRole('tab', { name: '设置' }).click();

    const timerHeader = page.getByRole('heading', { name: '计时设置' });
    const syncHeader = page.getByRole('heading', { name: '数据同步' });
    await expect(timerHeader).toBeVisible();
    await expect(syncHeader).toBeVisible();

    const [timerBox, syncBox] = await Promise.all([
      timerHeader.boundingBox(),
      syncHeader.boundingBox(),
    ]);
    expect(timerBox).not.toBeNull();
    expect(syncBox).not.toBeNull();
    expect(syncBox!.x).toBeGreaterThan(timerBox!.x);

    await expect(page.getByRole('button', { name: '导出数据' })).toHaveCSS('white-space', 'nowrap');
    await expect(page.getByRole('button', { name: '导入数据' })).toHaveCSS('white-space', 'nowrap');
  });
});
