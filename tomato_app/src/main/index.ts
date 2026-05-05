import { app, BrowserWindow, ipcMain } from 'electron';
import { createWindow } from './window.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { initDatabase } from './database.js';
import { createTray, updateTrayIcon, updateTrayTime, setTrayTaskTitle } from './tray.js';
import { notifyPomodoroComplete, notifyBreakComplete, setNotificationWindow } from './notifications.js';
import { registerShortcuts, unregisterShortcuts } from './shortcuts.js';
import { IPC } from '../shared/ipc-channels.js';

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(async () => {
  const { taskManager, statsRepo, settingsRepo } = initDatabase();
  await taskManager.initialize();

  mainWindow = createWindow();
  setNotificationWindow(mainWindow);
  registerIpcHandlers(() => mainWindow, taskManager, statsRepo, settingsRepo);

  createTray(() => mainWindow);

  // Listen for timer completion to show notifications + update tray
  ipcMain.on(IPC.TIMER_COMPLETE, (_event, type: 'work' | 'break') => {
    if (type === 'work') notifyPomodoroComplete();
    else notifyBreakComplete();
  });

  ipcMain.on(IPC.TIMER_STATUS_CHANGE, (_event, status: string) => {
    if (status === 'idle') {
      setTrayTaskTitle(undefined);
    }
    updateTrayIcon(status);
  });

  ipcMain.on(IPC.TIMER_TICK, (_event, remainingTime: number) => {
    // Get current status from timer state - we'll need to track this
    updateTrayTime('working', remainingTime);
  });

  ipcMain.on('timer:taskTitle', (_event, title: string | null) => {
    setTrayTaskTitle(title ?? undefined);
  });

  registerShortcuts({
    onStartPause: () => mainWindow?.webContents.send(IPC.TIMER_START),
    onStop: () => mainWindow?.webContents.send(IPC.TIMER_STOP),
    onNewTask: () => mainWindow?.webContents.send('focus:newTask'),
  });
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
