import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from './fixtures';
import { clearDataAndReload, createDefaultTask } from './helpers/acceptance-helpers';

test.describe('基础验收：任务与笔记', () => {
  test.beforeEach(async ({ page, electronApp }) => {
    await clearDataAndReload(page, electronApp);
  });

  test('任务笔记应持久化到 notes 目录并可在刷新后读回', async ({ page }) => {
    await createDefaultTask(page, '验收任务：写测试');

    const taskItem = page.getByTestId('task-item').filter({ hasText: '验收任务：写测试' }).first();
    await taskItem.click();
    await expect(page.getByRole('heading', { name: '验收任务：写测试' })).toBeVisible();

    const notesEditor = page.locator('textarea[placeholder="添加笔记..."]');
    const savingIndicator = page.getByTestId('task-notes-saving');
    await notesEditor.fill('## 验收笔记\n\n- 创建任务\n- 自动保存笔记');
    await expect(notesEditor).toHaveValue(/自动保存笔记/);

    let savingShown = false;
    try {
      await savingIndicator.waitFor({ state: 'visible', timeout: 3000 });
      savingShown = true;
    } catch {
      savingShown = false;
    }
    if (savingShown) {
      await expect(savingIndicator).toBeHidden();
    } else {
      await expect(savingIndicator).toHaveCount(0);
    }

    const { taskId, dataDir } = await page.evaluate(async (taskTitle: string) => {
      const tasks = await window.electronAPI.invoke('task:getAll');
      const task = tasks.find((item) => item.title === taskTitle);
      if (!task) {
        throw new Error(`Task not found: ${taskTitle}`);
      }
      const dataDir = await window.electronAPI.invoke('sync:get-data-dir');
      return {
        taskId: task.id,
        dataDir,
      };
    }, '验收任务：写测试');

    const notesPath = path.join(dataDir, 'notes', `${taskId}.md`);
    const fileContent = await fs.readFile(notesPath, 'utf8');
    expect(fileContent).toContain('自动保存笔记');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: '任务' }).click();

    const persistedTask = page.getByTestId('task-item').filter({ hasText: '验收任务：写测试' }).first();
    await expect(persistedTask).toBeVisible();
    await persistedTask.click();

    await expect(page.locator('textarea[placeholder="添加笔记..."]')).toHaveValue(/自动保存笔记/);

    await page.evaluate(async (taskIdToDelete: string) => {
      await window.electronAPI.invoke('task:delete', { id: taskIdToDelete });
    }, taskId);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: '任务' }).click();
    await expect(page.getByTestId('task-item').filter({ hasText: '验收任务：写测试' })).toHaveCount(0);
    await expect(fs.readFile(notesPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('空标题不应提交，编辑输入框保持可见', async ({ page }) => {
    const taskItem = await createDefaultTask(page);
    await taskItem.hover();
    await taskItem.locator('button').last().click();
    await taskItem.getByRole('button', { name: '编辑' }).click();

    const titleEditor = page.locator('input:focus');
    await expect(titleEditor).toBeVisible();
    await titleEditor.fill('   ');
    await titleEditor.press('Enter');

    await expect(titleEditor).toBeVisible();
    await titleEditor.press('Escape');
    await expect(taskItem.getByText('新任务')).toBeVisible();
  });
});
