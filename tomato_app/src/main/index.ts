import { app, BrowserWindow, ipcMain, session } from 'electron';
import { createWindow } from './window.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { initStorage } from './database.js';
import { createTray, setTrayTaskTitle } from './tray.js';
import { notifyPomodoroComplete, notifyBreakComplete, setNotificationWindow } from './notifications.js';
import { registerShortcuts, unregisterShortcuts } from './shortcuts.js';
import { safeSend } from './safe-send.js';
import { IPC } from '../shared/ipc-channels.js';
import { UpdateService } from './update/update-service.js';
import { registerUpdateIpcHandlers } from './update/update-ipc.js';

let mainWindow: BrowserWindow | null = null;
let updateService: UpdateService | null = null;

const testUserDataDir = process.env.NODE_ENV === 'test' ? process.env.TEST_E2E_USER_DATA_DIR : undefined;
if (testUserDataDir) {
  app.setPath('userData', testUserDataDir);
}

function setupNotificationPermissions() {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'notifications') {
      return true;
    }
    return false;
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'notifications') {
      callback(true);
    }
  });
}

app.whenReady().then(async () => {
  setupNotificationPermissions();
  const { taskManager, statsRepo, configRepo } = await initStorage();
  await taskManager.initialize();
  updateService = new UpdateService();

  mainWindow = createWindow();
  setNotificationWindow(mainWindow);
  registerIpcHandlers(() => mainWindow, taskManager, statsRepo, configRepo, {
    onPomodoroComplete: notifyPomodoroComplete,
    onBreakComplete: notifyBreakComplete,
  });
  registerUpdateIpcHandlers(updateService);

  createTray(() => mainWindow);

  ipcMain.handle(IPC.TIMER_TASK_TITLE, async (_event, title: string | null) => {
    setTrayTaskTitle(title ?? undefined);
  });

  registerShortcuts({
    onStartPause: () => safeSend(mainWindow, IPC.TIMER_START),
    onStop: () => safeSend(mainWindow, IPC.TIMER_STOP),
    onNewTask: () => safeSend(mainWindow, 'focus:newTask'),
  });

  void updateService.checkForUpdates().catch((error) => {
    console.warn('Update check failed:', error);
  });

  // 测试环境专用 IPC
  if (process.env.NODE_ENV === 'test') {
    const { clearDatabase } = await import('./database.js');

    ipcMain.handle('test:clear-database', async () => {
      await clearDatabase();
      await taskManager.initialize();
      await updateService?.resetForTests();
      return { success: true };
    });

  }
}).catch((err) => {
  console.error('Failed to start app:', err);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});

app.on('will-quit', () => {
  unregisterShortcuts();
});
