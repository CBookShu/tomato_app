import { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function openTasksTab(page: Page): Promise<void> {
  await page.getByRole('tab', { name: '任务' }).click();
}

async function createGroup(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: '新建分组' }).click();
  await page.getByPlaceholder('输入分组名称').fill(name);
  await page.getByRole('button', { name: '创建' }).click();
  await expect(page.getByText(name)).toBeVisible();
}

function groupRow(page: Page, name: string): Locator {
  return page.getByTestId('task-group').filter({ has: page.getByText(name, { exact: true }) });
}

async function renameGroup(page: Page, currentName: string, nextName: string): Promise<void> {
  const row = groupRow(page, currentName);
  await row.getByRole('button', { name: '分组操作' }).click();
  await page.getByRole('button', { name: '重命名' }).click();
  const input = page.locator('[data-testid="task-group"] input').first();
  await input.fill(nextName);
  await input.press('Enter');
  await expect(page.getByText(nextName)).toBeVisible();
}

async function createTaskInGroup(page: Page, groupName: string, title: string): Promise<void> {
  const row = groupRow(page, groupName);
  await row.getByRole('button', { name: '新建任务' }).click();
  const newTaskItem = page.getByTestId('task-item').filter({ hasText: '新任务' }).last();
  await expect(newTaskItem).toBeVisible();

  await newTaskItem.hover();
  await newTaskItem.locator('button').last().click();
  await newTaskItem.getByRole('button', { name: '编辑' }).click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(title);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('task-item').filter({ hasText: title })).toBeVisible();
}

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await openTasksTab(page);
  });

  test('shows new group button', async ({ page }) => {
    await expect(page.getByRole('button', { name: '新建分组' })).toBeVisible();
  });

  test('creates and renames a group that persists after reload', async ({ page }) => {
    await createGroup(page, '工作');
    await page.reload();
    await openTasksTab(page);
    await expect(page.getByText('工作')).toBeVisible();

    await renameGroup(page, '工作', '项目');
    await page.reload();
    await openTasksTab(page);
    await expect(page.getByText('项目')).toBeVisible();
  });

  test('deletes a normal group, migrates its tasks to 未分组, and keeps task order', async ({ page }) => {
    await createGroup(page, '工作');
    await createTaskInGroup(page, '工作', 'Alpha');
    await createTaskInGroup(page, '工作', 'Beta');

    const workRow = groupRow(page, '工作');
    await workRow.getByRole('button', { name: '分组操作' }).click();
    await page.getByRole('button', { name: '删除' }).click();
    await page.getByRole('button', { name: '删除' }).click();

    await expect(page.getByText('工作')).toHaveCount(0);
    await expect(page.getByText('未分组')).toBeVisible();

    const taskTitles = await page.getByTestId('task-item').locator('span.flex-1').allTextContents();
    expect(taskTitles).toEqual(['Alpha', 'Beta']);

    await page.reload();
    await openTasksTab(page);
    await expect(page.getByText('工作')).toHaveCount(0);
    await expect(page.getByTestId('task-item').filter({ hasText: 'Alpha' })).toBeVisible();
    await expect(page.getByTestId('task-item').filter({ hasText: 'Beta' })).toBeVisible();
  });

  test('does not show delete controls for the default group', async ({ page }) => {
    await expect(groupRow(page, '未分组').getByRole('button', { name: '分组操作' })).toHaveCount(0);
  });
});
