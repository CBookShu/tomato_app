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

  test('创建任务 -> 编辑 -> 开始番茄 -> 暂停/继续 -> 完成 -> 休息', async ({ page }) => {
    // === 步骤1: 创建任务 ===
    await page.getByRole('tab', { name: '任务' }).click();

    // 验证默认分组存在（名称为"未分组"）
    await expect(page.getByText('未分组')).toBeVisible();

    // 新建任务：点击分组旁边的 + 按钮（title="新建任务"）
    await page.getByTitle('新建任务').click();

    // 任务创建后会自动创建名为"新任务"的任务
    const newTaskItem = page.getByTestId('task-item').filter({ hasText: '新任务' }).first();
    await expect(newTaskItem).toBeVisible();

    // === 步骤2: 编辑任务（双击任务标题进入编辑模式）===
    await newTaskItem.dblclick();
    // 找到输入框并修改任务标题
    const input = page.locator('input').filter({ hasText: '' }).first();
    await input.fill('完成项目报告');
    await input.press('Enter');

    await expect(page.getByTestId('task-item').filter({ hasText: '完成项目报告' }).first()).toBeVisible();

    // === 步骤3: 开始番茄计时 ===
    // 在任务列表中点击任务的播放按钮开始计时
    const taskItem = page.getByTestId('task-item').filter({ hasText: '完成项目报告' });
    // 悬停以显示操作按钮
    await taskItem.hover();
    // 点击播放按钮（Play 图标）开始计时
    await taskItem.getByRole('button').filter({ has: page.locator('svg') }).first().click();

    // 切换到计时视图验证计时器状态
    await page.getByRole('tab', { name: '计时' }).click();

    // 验证计时器正在运行
    await expect(page.getByTestId('timer-pause-button')).toBeVisible();
    await expect(page.getByTestId('timer-display')).toBeVisible();

    // 验证当前任务显示
    await expect(page.getByText('当前任务：完成项目报告')).toBeVisible();

    // === 步骤4: 暂停/继续 ===
    await page.getByTestId('timer-pause-button').click();
    await expect(page.getByTestId('timer-resume-button')).toBeVisible();

    await page.getByTestId('timer-resume-button').click();
    await expect(page.getByTestId('timer-pause-button')).toBeVisible();

    // === 步骤5: 等待番茄钟结束（5秒） ===
    await expect(page.getByText(/休息|短休息/)).toBeVisible({ timeout: 10000 });

    // === 步骤6: 等待休息结束（3秒） ===
    await expect(page.getByTestId('timer-start-button')).toBeVisible({ timeout: 8000 });
  });
});
