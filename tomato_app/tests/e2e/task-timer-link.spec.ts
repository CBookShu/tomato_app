import { test, expect, Page, ElectronApplication } from './fixtures';

test.describe('任务-计时器联动', () => {
  test.beforeEach(async ({ page, electronApp }) => {
    // 等待页面加载完成
    await page.waitForLoadState('domcontentloaded');

    // 通过 IPC 清理数据库
    await electronApp.evaluate(async ({ ipcMain }) => {
      const handlers = ipcMain.listeners('test:clear-database');
      if (handlers.length > 0) {
        await ipcMain.invoke('test:clear-database');
      }
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

  // 验证默认分组存在（名称为"未分组"）
  await expect(page.getByText('未分组')).toBeVisible();

  // 新建任务：点击分组旁边的 + 按钮（title="新建任务"）
  await page.getByTitle('新建任务').click();

  // 任务创建后会自动创建名为"新任务"的任务
  await expect(page.getByText('新任务')).toBeVisible();

  // 编辑任务（双击任务标题进入编辑模式）
  await page.getByText('新任务').dblclick();
  // 找到输入框并修改任务标题
  const input = page.locator('input').filter({ hasText: '' }).first();
  await input.fill(taskTitle);
  await input.press('Enter');

  await expect(page.getByText(taskTitle)).toBeVisible();

  // 在任务列表中点击任务的播放按钮开始计时
  const taskItem = page.getByTestId('task-item').filter({ hasText: taskTitle });
  // 悬停以显示操作按钮
  await taskItem.hover();
  // 点击播放按钮（Play 图标）开始计时
  await taskItem.getByRole('button').filter({ has: page.locator('svg') }).first().click();
}
