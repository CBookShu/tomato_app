import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000, // Electron 启动较慢
  retries: 1,
  use: {
    // Electron 应用配置
    headless: false, // Electron 必须非 headless
  },
  // 移除 webServer 配置，因为测试 Electron 应用
});
