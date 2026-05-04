import { BrowserWindow, app } from 'electron';
import path from 'node:path';

const isDev = !app.isPackaged;

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173').catch((err) => {
      console.error('Failed to load dev server:', err.message);
    });
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html')).catch((err) => {
      console.error('Failed to load renderer:', err.message);
    });
  }

  return win;
}
