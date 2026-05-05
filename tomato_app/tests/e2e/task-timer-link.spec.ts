import { test, expect, Page } from './fixtures';

test.describe('任务-计时器联动', () => {
  test.beforeEach(async ({ electronApp }) => {
    await electronApp.evaluate(({ ipcMain }) => {
      return new Promise((resolve) => {
        ipcMain.handle('test:clear-database', async () => {
          resolve(undefined);
          return { success: true };
        });
        ipcMain.emit('test:clear-database');
      });
    });
  });

  test('开始计时的任务在任务列表显示计时状态', async ({ page }) => {
    // 创建任务并开始计时
    await createTaskAndStartTimer(page, '测试任务');

    // 切换到任务列表
    await page.getByRole('tab', { name: '任务' }).click();

    // 验证任务显示计时状态
    const taskItem = page.getByTestId('task-item').filter({ hasText: '测试任务' });
    await expect(taskItem.getByTestId('timer-indicator')).toBeVisible();

    // 验证分组显示倒计时（如果有）
    const groupTimer = page.locator('text=/🍅.*\\d{2}:\\d{2}/');
    if (await groupTimer.isVisible()) {
      await expect(groupTimer).toBeVisible();
    }

    // 停止计时
    await page.getByRole('tab', { name: '计时' }).click();
    await page.getByTestId('timer-stop-button').click();

    // 验证计时状态消失
    await page.getByRole('tab', { name: '任务' }).click();
    await expect(taskItem.getByTestId('timer-indicator')).not.toBeVisible();
  });

  test('状态栏显示当前任务名称', async ({ page }) => {
    await createTaskAndStartTimer(page, '重要任务');

    // 检查状态栏
    const statusBar = page.getByTestId('status-bar');
    await expect(statusBar.getByText('重要任务')).toBeVisible();
  });
});

// 辅助函数
async function createTaskAndStartTimer(page: Page, taskTitle: string) {
  await page.getByRole('tab', { name: '任务' }).click();
  await page.getByRole('button', { name: '新建任务' }).click();
  await page.getByPlaceholder('任务标题').fill(taskTitle);
  await page.getByRole('button', { name: '保存' }).click();

  await page.getByRole('tab', { name: '计时' }).click();

  // 选择任务（如果有选择任务的 UI）
  const selectTaskButton = page.getByRole('button', { name: '选择任务' });
  if (await selectTaskButton.isVisible()) {
    await selectTaskButton.click();
    await page.getByText(taskTitle).click();
  }

  await page.getByTestId('timer-start-button').click();
}
