import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';

let tray: Tray | null = null;

function createIcon(color: string): Electron.NativeImage {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  const colors: Record<string, [number, number, number]> = {
    red: [239, 68, 68],
    green: [16, 185, 129],
    gray: [156, 163, 175],
  };
  const [r, g, b] = colors[color] ?? colors.gray;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - size / 2 + 0.5;
      const dy = y - size / 2 + 0.5;
      if (dx * dx + dy * dy <= (size / 2 - 1) ** 2) {
        canvas[idx] = r;
        canvas[idx + 1] = g;
        canvas[idx + 2] = b;
        canvas[idx + 3] = 255;
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  const icon = createIcon('gray');
  tray = new Tray(icon);
  tray.setToolTip('Tomato - 就绪');

  tray.on('click', () => {
    const win = getWindow();
    if (win) {
      win.isVisible() ? win.hide() : win.show();
    }
  });

  updateTrayMenu(getWindow, 'idle', 0);
  return tray;
}

function updateTrayMenu(getWindow: () => BrowserWindow | null, status: string, remainingTime: number) {
  if (!tray) return;

  const statusLabels: Record<string, string> = {
    idle: '就绪',
    working: '专注中',
    paused: '已暂停',
    breaking: '短休息',
    'long-break': '长休息',
  };

  const timeStr = remainingTime > 0 ? ` - ${formatTime(remainingTime)}` : '';
  const statusLabel = statusLabels[status] || '就绪';

  const menu = Menu.buildFromTemplate([
    {
      label: `${statusLabel}${timeStr}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '打开应用',
      click: () => {
        const win = getWindow();
        win?.show();
        win?.focus();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(menu);
}

export function updateTrayIcon(status: string, remainingTime?: number) {
  if (!tray) return;
  const color = status === 'working' ? 'red' : status === 'breaking' || status === 'long-break' ? 'green' : 'gray';
  tray.setImage(createIcon(color));

  // Update tooltip and menu with time
  const time = remainingTime ?? 0;
  const statusLabels: Record<string, string> = {
    idle: '就绪',
    working: '专注中',
    paused: '已暂停',
    breaking: '短休息',
    'long-break': '长休息',
  };

  const timeStr = time > 0 ? ` ${formatTime(time)}` : '';
  tray.setToolTip(`Tomato - ${statusLabels[status] || '就绪'}${timeStr}`);
}

export function updateTrayTime(status: string, remainingTime: number) {
  if (!tray) return;
  updateTrayIcon(status, remainingTime);
}
