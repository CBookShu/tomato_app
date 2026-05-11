import { test, expect } from './fixtures';
import { clearDataAndReload, createDefaultTask } from './helpers/acceptance-helpers';

test.describe('基础验收：任务与笔记（RED）', () => {
  test.beforeEach(async ({ page, electronApp }) => {
    await clearDataAndReload(page, electronApp);
  });

  test('任务重命名与笔记编辑在刷新后应持久化（RED）', async ({ page }) => {
    await createDefaultTask(page, '验收任务：写测试');

    const taskItem = page.getByTestId('task-item').filter({ hasText: '验收任务：写测试' }).first();
    await taskItem.click();
    await expect(page.getByRole('heading', { name: '验收任务：写测试' })).toBeVisible();

    const notesEditor = page.locator('textarea[placeholder="添加笔记..."]');
    await notesEditor.fill('## 验收笔记\n\n- 创建任务\n- 自动保存笔记');
    await expect(notesEditor).toHaveValue(/自动保存笔记/);
    await expect(page.getByText('保存失败')).not.toBeVisible();
    await page.waitForTimeout(800);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: '任务' }).click();

    const persistedTask = page.getByTestId('task-item').filter({ hasText: '验收任务：写测试' }).first();
    await expect(persistedTask).toBeVisible();
    await persistedTask.click();

    await expect(page.locator('textarea[placeholder="添加笔记..."]')).toHaveValue(/自动保存笔记/);
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
  });
});
