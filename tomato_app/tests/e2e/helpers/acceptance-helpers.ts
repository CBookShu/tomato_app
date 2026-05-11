import { ElectronApplication, Locator, Page } from '@playwright/test';
import { expect } from '../fixtures';

export async function clearDataAndReload(page: Page, electronApp: ElectronApplication): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await electronApp.evaluate(async ({ ipcMain }) => {
    const handlers = ipcMain.listeners('test:clear-database');
    if (handlers.length > 0) {
      await ipcMain.invoke('test:clear-database');
    }
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
}

export async function createDefaultTask(page: Page, title = '新任务'): Promise<Locator> {
  await page.getByRole('tab', { name: '任务' }).click();
  await expect(page.getByText('未分组')).toBeVisible();

  await page.getByTitle('新建任务').click();
  const newTaskItem = page.getByTestId('task-item').filter({ hasText: '新任务' }).first();
  await expect(newTaskItem).toBeVisible();

  if (title !== '新任务') {
    await page.evaluate(async (nextTitle) => {
      const tasks = await window.electronAPI.invoke('task:getAll');
      const target = tasks.find((task: { id: string; title: string }) => task.title === '新任务');
      if (!target) {
        throw new Error('Unable to find default task to rename');
      }
      await window.electronAPI.invoke('task:edit', {
        id: target.id,
        updates: { title: nextTitle },
      });
    }, title);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: '任务' }).click();
  }

  const taskItem = page.getByTestId('task-item').filter({ hasText: title }).first();
  await expect(taskItem).toBeVisible();
  return taskItem;
}
