import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test as base } from '@playwright/test';
import { _electron as electron, ElectronApplication, Page } from '@playwright/test';

type MyFixtures = {
  electronApp: ElectronApplication;
  page: Page;
};

export const test = base.extend<MyFixtures>({
  electronApp: async ({}, use, testInfo) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `tomato-e2e-${testInfo.workerIndex}-`));
    const app = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TZ: 'UTC',
        TEST_POMODORO_DURATION: '5',    // 5秒番茄钟
        TEST_BREAK_DURATION: '3',        // 3秒休息
        TEST_LONG_BREAK_DURATION: '5',   // 5秒长休息
        TEST_E2E_USER_DATA_DIR: userDataDir,
      },
    });

    try {
      await use(app);
    } finally {
      await app.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  },

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export { expect } from '@playwright/test';
