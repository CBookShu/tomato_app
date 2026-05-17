import { ElectronApplication, Locator, Page } from '@playwright/test';
import { launchElectronApp, test, expect } from './fixtures';

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

async function relaunchApp(app: ElectronApplication, userDataDir: string): Promise<{
  app: ElectronApplication;
  page: Page;
}> {
  await app.close();
  const nextApp = await launchElectronApp(userDataDir);
  const nextPage = await nextApp.firstWindow();
  await nextPage.waitForLoadState('domcontentloaded');
  return { app: nextApp, page: nextPage };
}

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await openTasksTab(page);
  });

  test('shows new group button', async ({ page }) => {
    await expect(page.getByRole('button', { name: '新建分组' })).toBeVisible();
  });

  test('creates and renames a group that persists after app relaunch', async ({ page, electronApp, userDataDir }) => {
    let currentApp = electronApp;
    let currentPage = page;

    await createGroup(currentPage, '工作');
    ({ app: currentApp, page: currentPage } = await relaunchApp(currentApp, userDataDir));
    await openTasksTab(currentPage);
    await expect(currentPage.getByText('工作')).toBeVisible();

    await renameGroup(currentPage, '工作', '项目');
    ({ app: currentApp, page: currentPage } = await relaunchApp(currentApp, userDataDir));
    await openTasksTab(currentPage);
    await expect(currentPage.getByText('项目')).toBeVisible();

    await currentApp.close();
  });

  test('deletes a normal group, migrates its tasks to 未分组, and keeps task order after relaunch', async ({
    page,
    electronApp,
    userDataDir,
  }) => {
    let currentApp = electronApp;
    let currentPage = page;

    await createGroup(currentPage, '工作');
    await createTaskInGroup(currentPage, '工作', 'Alpha');
    await createTaskInGroup(currentPage, '工作', 'Beta');

    const workRow = groupRow(currentPage, '工作');
    await workRow.getByRole('button', { name: '分组操作' }).click();
    await currentPage.getByRole('button', { name: '删除' }).click();
    await currentPage.getByRole('button', { name: '删除' }).click();

    await expect(currentPage.getByText('工作')).toHaveCount(0);
    await expect(currentPage.getByText('未分组')).toBeVisible();

    const taskTitles = await currentPage.getByTestId('task-item').locator('span.flex-1').allTextContents();
    expect(taskTitles).toEqual(['Alpha', 'Beta']);

    ({ app: currentApp, page: currentPage } = await relaunchApp(currentApp, userDataDir));
    await openTasksTab(currentPage);
    await expect(currentPage.getByText('工作')).toHaveCount(0);
    await expect(currentPage.getByTestId('task-item').filter({ hasText: 'Alpha' })).toBeVisible();
    await expect(currentPage.getByTestId('task-item').filter({ hasText: 'Beta' })).toBeVisible();

    await currentApp.close();
  });

  test('does not show delete controls for the default group', async ({ page }) => {
    await expect(groupRow(page, '未分组').getByRole('button', { name: '分组操作' })).toHaveCount(0);
  });
});
