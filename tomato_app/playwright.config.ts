import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000, // Electron 启动较慢，增加到 2 分钟
  retries: 0, // 先不重试，方便诊断问题
  use: {
    // Electron 应用配置
    headless: false, // Electron 必须非 headless
  },
  // 移除 webServer 配置，因为测试 Electron 应用
});
