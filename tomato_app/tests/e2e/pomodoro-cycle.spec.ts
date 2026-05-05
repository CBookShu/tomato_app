import { test, expect } from './fixtures';

test.describe('完整番茄工作循环', () => {
  test.beforeEach(async ({ electronApp }) => {
    // 清空数据库
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

  test('创建任务 -> 编辑 -> 开始番茄 -> 暂停/继续 -> 完成 -> 休息', async ({ page }) => {
    // === 步骤1: 创建任务 ===
    await page.getByRole('tab', { name: '任务' }).click();

    // 验证默认分组存在
    await expect(page.getByText('默认分组')).toBeVisible();

    // 新建任务
    await page.getByRole('button', { name: '新建任务' }).click();
    await page.getByPlaceholder('任务标题').fill('完成项目报告');
    await page.getByRole('button', { name: '保存' }).click();

    // 验证任务创建成功
    await expect(page.getByText('完成项目报告')).toBeVisible();

    // === 步骤2: 编辑任务 ===
    await page.getByText('完成项目报告').dblclick();
    await page.getByPlaceholder('任务标题').fill('完成项目报告（修订版）');
    await page.getByRole('button', { name: '保存' }).click();

    await expect(page.getByText('完成项目报告（修订版）')).toBeVisible();

    // === 步骤3: 开始番茄计时 ===
    await page.getByRole('tab', { name: '计时' }).click();

    // 选择任务（如果有选择任务的 UI）
    const selectTaskButton = page.getByRole('button', { name: '选择任务' });
    if (await selectTaskButton.isVisible()) {
      await selectTaskButton.click();
      await page.getByText('完成项目报告（修订版）').click();
    }

    // 开始计时
    await page.getByTestId('timer-start-button').click();

    // 验证计时器正在运行
    await expect(page.getByTestId('timer-pause-button')).toBeVisible();
    await expect(page.getByTestId('timer-display')).toBeVisible();

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
