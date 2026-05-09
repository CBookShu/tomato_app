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
    // 创建任务并开始计时（不编辑任务标题）
    await createTaskAndStartTimer(page);

    // 切换到任务列表
    await page.getByRole('tab', { name: '任务' }).click();

    // 验证任务显示计时状态
    const taskItem = page.getByTestId('task-item').filter({ hasText: '新任务' });
    await expect(taskItem.getByTestId('timer-indicator')).toBeVisible();

    // 停止计时
    await page.getByRole('tab', { name: '计时' }).click();
    await page.getByTestId('timer-stop-button').click();

    // 验证计时状态消失
    await page.getByRole('tab', { name: '任务' }).click();
    await expect(taskItem.getByTestId('timer-indicator')).not.toBeVisible();
  });

  test('状态栏显示当前任务名称', async ({ page }) => {
    await createTaskAndStartTimer(page);

    // 检查状态栏
    const statusBar = page.getByTestId('status-bar');
    await expect(statusBar.getByText('新任务')).toBeVisible();
  });

  test('番茄钟结束后进入休息时，任务仍显示关联图标（无动画）', async ({ page }) => {
    await createTaskAndStartTimer(page);

    // 等待番茄钟结束（5秒配置）
    await expect(page.getByText(/休息|休息中/)).toBeVisible({ timeout: 10000 });

    // 切换到任务列表
    await page.getByRole('tab', { name: '任务' }).click();

    // 验证任务仍显示番茄图标（表示上一个专注的任务）
    const taskItem = page.getByTestId('task-item').filter({ hasText: '新任务' });
    const timerIndicator = taskItem.getByTestId('timer-indicator');
    await expect(timerIndicator).toBeVisible();

    // 验证图标没有动画效果（通过检查类名）
    const className = await timerIndicator.getAttribute('class');
    expect(className).not.toContain('animate-pulse');
  });
});

// 辅助函数：创建任务并开始计时（不编辑标题）
async function createTaskAndStartTimer(page: Page) {
  await page.getByRole('tab', { name: '任务' }).click();

  // 验证默认分组存在
  await expect(page.getByText('未分组')).toBeVisible();

  // 新建任务
  await page.getByTitle('新建任务').click();

  // 任务创建后会自动创建名为"新任务"的任务
  const newTaskItem = page.getByTestId('task-item').filter({ hasText: '新任务' }).first();
  await expect(newTaskItem).toBeVisible();

  // 在任务列表中点击任务开始计时
  // 悬停以显示操作按钮
  await newTaskItem.hover();
  // 点击 MoreHorizontal 按钮打开下拉菜单（任务项最后一个按钮）
  const moreButton = newTaskItem.locator('button').last();
  await moreButton.click();
  // 点击菜单中的"开始专注"选项
  await page.getByText('开始专注').click();

  // 等待计时器启动
  await page.waitForTimeout(500);
}
