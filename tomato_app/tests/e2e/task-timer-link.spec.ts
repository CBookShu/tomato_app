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

  // 在任务列表中点击任务的播放按钮开始计时
  // 悬停以显示操作按钮
  await newTaskItem.hover();
  // 点击播放按钮（Play 图标）开始计时
  const playButton = newTaskItem.getByRole('button').filter({ has: page.locator('svg.lucide-play') });
  await playButton.click();
  
  // 等待计时器启动
  await page.waitForTimeout(500);
}
