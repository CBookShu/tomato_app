import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import { IPC } from '../shared/ipc-channels.js';

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let currentTaskTitle: string | undefined = undefined;

export type TimerStatus = 'idle' | 'working' | 'paused' | 'breaking' | 'long-break';

function generateTrayIcon(status: TimerStatus, timeStr?: string): Electron.NativeImage {
  const width = 44;  // Wider to accommodate text
  const height = 44;
  const canvas = Buffer.alloc(width * height * 4);

  const colors: Record<string, [number, number, number]> = {
    working: [239, 68, 68],    // red #EF4444
    breaking: [34, 197, 94],   // green #22C55E
    'long-break': [34, 197, 94],
    paused: [251, 146, 60],    // orange
    idle: [156, 163, 175],     // gray
  };

  const [r, g, b] = colors[status] || colors.idle;
  const alpha = status === 'idle' ? 102 : 255; // 40% opacity for idle

  // Draw tomato shape (circle)
  const centerX = 12;
  const centerY = 22;
  const radius = 10;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radius * radius) {
        canvas[idx] = r;
        canvas[idx + 1] = g;
        canvas[idx + 2] = b;
        canvas[idx + 3] = alpha;
      }
    }
  }

  // Draw time text if available
  if (timeStr && timeStr.length >= 4) {
    // Simple digit rendering - each digit is 5x7
    const digits: Record<string, number[][]> = {
      '0': [[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1]],
      '1': [[0,0,1,0,0],[0,1,1,0,0],[1,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1]],
      '2': [[1,1,1,1,1],[0,0,0,0,1],[0,0,0,0,1],[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
      '3': [[1,1,1,1,1],[0,0,0,0,1],[0,0,0,0,1],[1,1,1,1,1],[0,0,0,0,1],[0,0,0,0,1],[1,1,1,1,1]],
      '4': [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[0,0,0,0,1],[0,0,0,0,1],[0,0,0,0,1]],
      '5': [[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1],[0,0,0,0,1],[0,0,0,0,1],[1,1,1,1,1]],
      '6': [[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1]],
      '7': [[1,1,1,1,1],[0,0,0,0,1],[0,0,0,0,1],[0,0,0,0,1],[0,0,0,0,1],[0,0,0,0,1],[0,0,0,0,1]],
      '8': [[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1]],
      '9': [[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[0,0,0,0,1],[0,0,0,0,1],[1,1,1,1,1]],
      ':': [[0,0,0,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,0,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,0,0,0]],
    };

    const startX = 24;
    const startY = 15;
    const pixelSize = 2;

    for (let i = 0; i < timeStr.length && i < 5; i++) {
      const char = timeStr[i];
      const pattern = digits[char];
      if (pattern) {
        for (let row = 0; row < pattern.length; row++) {
          for (let col = 0; col < pattern[row].length; col++) {
            if (pattern[row][col]) {
              for (let py = 0; py < pixelSize; py++) {
                for (let px = 0; px < pixelSize; px++) {
                  const x = startX + i * 6 + col * pixelSize + px;
                  const y = startY + row * pixelSize + py;
                  if (x < width && y < height) {
                    const idx = (y * width + x) * 4;
                    canvas[idx] = 255;     // white text
                    canvas[idx + 1] = 255;
                    canvas[idx + 2] = 255;
                    canvas[idx + 3] = 255;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width, height });
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  mainWindow = getWindow();
  const icon = generateTrayIcon('idle');
  tray = new Tray(icon);
  tray.setToolTip('Tomato - 就绪');

  // Double-click to open/focus window
  tray.on('double-click', () => {
    const win = mainWindow || getWindow();
    if (win) {
      win.show();
      win.focus();
    }
  });

  // Single click toggles window visibility
  tray.on('click', () => {
    const win = mainWindow || getWindow();
    if (win) {
      win.isVisible() ? win.hide() : win.show();
    }
  });

  updateTrayMenu('idle', 0);
  return tray;
}

function updateTrayMenu(status: TimerStatus, remainingTime: number) {
  if (!tray) return;

  const statusLabels: Record<string, string> = {
    idle: '就绪',
    working: '专注中',
    paused: '已暂停',
    breaking: '短休息',
    'long-break': '长休息',
  };

  const timeStr = remainingTime > 0 ? formatTime(remainingTime) : '';
  const statusLabel = statusLabels[status] || '就绪';

  const menuItems: Electron.MenuItemConstructorOptions[] = [
    { label: statusLabel, enabled: false },
  ];

  if (timeStr) {
    menuItems.push({ label: timeStr, enabled: false });
  }

  if (currentTaskTitle) {
    const truncated = currentTaskTitle.length > 15
      ? currentTaskTitle.slice(0, 15) + '...'
      : currentTaskTitle;
    menuItems.push({ label: `当前: ${truncated}`, enabled: false });
  }

  menuItems.push({ type: 'separator' });

  // Add action buttons based on status
  if (status === 'working') {
    menuItems.push({
      label: '⏸ 暂停',
      click: () => mainWindow?.webContents.send(IPC.TRAY_PAUSE),
    });
    menuItems.push({
      label: '⏹ 停止',
      click: () => mainWindow?.webContents.send(IPC.TRAY_STOP),
    });
  } else if (status === 'breaking' || status === 'long-break') {
    menuItems.push({
      label: '⏭ 跳过休息',
      click: () => mainWindow?.webContents.send(IPC.TRAY_SKIP_BREAK),
    });
    menuItems.push({
      label: '⏹ 停止',
      click: () => mainWindow?.webContents.send(IPC.TRAY_STOP),
    });
  }

  menuItems.push({ type: 'separator' });

  menuItems.push({
    label: '📂 打开应用',
    click: () => {
      mainWindow?.show();
      mainWindow?.focus();
    },
  });

  menuItems.push({
    label: '🚪 退出',
    click: () => app.quit(),
  });

  tray.setContextMenu(Menu.buildFromTemplate(menuItems));
}

export function updateTrayIcon(status: TimerStatus, remainingTime?: number) {
  if (!tray) return;

  const timeStr = remainingTime && remainingTime > 0 ? formatTime(remainingTime) : undefined;
  const icon = generateTrayIcon(status, timeStr);
  tray.setImage(icon);

  const statusLabels: Record<string, string> = {
    idle: '就绪',
    working: '专注中',
    paused: '已暂停',
    breaking: '短休息',
    'long-break': '长休息',
  };

  const timeDisplay = timeStr ? ` ${timeStr}` : '';
  tray.setToolTip(`Tomato - ${statusLabels[status] || '就绪'}${timeDisplay}`);

  updateTrayMenu(status, remainingTime ?? 0);
}

export function updateTrayTime(status: TimerStatus, remainingTime: number) {
  if (!tray) return;
  updateTrayIcon(status, remainingTime);
}

export function setTrayTaskTitle(title: string | undefined) {
  currentTaskTitle = title;
}
