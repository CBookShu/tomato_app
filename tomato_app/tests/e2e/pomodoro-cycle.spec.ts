import { test, expect } from './fixtures';

test.describe('完整番茄工作循环', () => {
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

  test('创建任务 -> 开始番茄 -> 暂停/继续 -> 完成 -> 休息', async ({ page }) => {
    // === 步骤1: 创建任务 ===
    await page.getByRole('tab', { name: '任务' }).click();

    // 验证默认分组存在
    await expect(page.getByText('未分组')).toBeVisible();

    // 新建任务
    await page.getByTitle('新建任务').click();

    // 任务创建后会自动创建名为"新任务"的任务
    const newTaskItem = page.getByTestId('task-item').filter({ hasText: '新任务' }).first();
    await expect(newTaskItem).toBeVisible();

    // === 步骤2: 开始番茄计时 ===
    // 悬停以显示操作按钮
    await newTaskItem.hover();
    // 点击播放按钮开始计时
    const playButton = newTaskItem.getByRole('button').filter({ has: page.locator('svg.lucide-play') });
    await playButton.click();

    // 切换到计时视图验证计时器状态
    await page.getByRole('tab', { name: '计时' }).click();

    // 验证计时器正在运行
    await expect(page.getByTestId('timer-pause-button')).toBeVisible();
    await expect(page.getByTestId('timer-display')).toBeVisible();

    // 验证当前任务显示
    await expect(page.getByText('当前任务：新任务')).toBeVisible();

    // === 步骤3: 暂停/继续 ===
    await page.getByTestId('timer-pause-button').click();
    await expect(page.getByTestId('timer-resume-button')).toBeVisible();

    await page.getByTestId('timer-resume-button').click();
    await expect(page.getByTestId('timer-pause-button')).toBeVisible();

    // === 步骤4: 等待番茄钟结束（5秒） ===
    // 使用更精确的选择器，匹配状态文本
    await expect(page.getByText('休息中')).toBeVisible({ timeout: 10000 });

    // === 步骤5: 等待休息结束（3秒） ===
    await expect(page.getByTestId('timer-start-button')).toBeVisible({ timeout: 8000 });
  });
});
