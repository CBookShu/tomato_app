import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test as base } from '@playwright/test';
import { _electron as electron, ElectronApplication, Page } from '@playwright/test';

type MyFixtures = {
  electronApp: ElectronApplication;
  page: Page;
  userDataDir: string;
};

function getElectronLaunchEnv(userDataDir: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'test',
    TZ: 'UTC',
    TEST_POMODORO_DURATION: '5',
    TEST_BREAK_DURATION: '3',
    TEST_LONG_BREAK_DURATION: '5',
    TEST_E2E_USER_DATA_DIR: userDataDir,
  };
}

export async function launchElectronApp(userDataDir: string): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.'],
    env: getElectronLaunchEnv(userDataDir),
  });
}

export const test = base.extend<MyFixtures>({
  userDataDir: async ({}, use, testInfo) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `tomato-e2e-${testInfo.workerIndex}-`));
    try {
      await use(userDataDir);
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  },

  electronApp: async ({ userDataDir }, use) => {
    const app = await launchElectronApp(userDataDir);

    try {
      await use(app);
    } finally {
      try {
        await app.close();
      } catch {
        // Tests may close and relaunch the app explicitly.
      }
    }
  },

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export { expect } from '@playwright/test';
