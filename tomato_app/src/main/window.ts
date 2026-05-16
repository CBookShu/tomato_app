import { BrowserWindow, app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const isTest = process.env.NODE_ENV === 'test';
const TITLEBAR_HEIGHT = 40;

function setupTitlebarInteractions(win: BrowserWindow): void {
  win.webContents.on('before-mouse-event', (event, mouse) => {
    if (mouse.type !== 'mouseDown' || mouse.button !== 'left' || mouse.clickCount !== 2) {
      return;
    }

    if (mouse.y > TITLEBAR_HEIGHT) {
      return;
    }

    event.preventDefault();
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
}

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 800,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  setupTitlebarInteractions(win);

  if (isDev && !isTest) {
    win.loadURL('http://localhost:5173').catch((err) => {
      console.error('Failed to load dev server:', err.message);
    });
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html')).catch((err) => {
      console.error('Failed to load renderer:', err.message);
    });
  }

  return win;
}
