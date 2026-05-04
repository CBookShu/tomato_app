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

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  const icon = createIcon('gray');
  tray = new Tray(icon);
  tray.setToolTip('Tomato');

  tray.on('click', () => {
    const win = getWindow();
    if (win) {
      win.isVisible() ? win.hide() : win.show();
    }
  });

  updateTrayMenu(getWindow);
  return tray;
}

function updateTrayMenu(getWindow: () => BrowserWindow | null) {
  if (!tray) return;

  const menu = Menu.buildFromTemplate([
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

export function updateTrayIcon(status: string) {
  if (!tray) return;
  const color = status === 'working' ? 'red' : status === 'breaking' || status === 'long-break' ? 'green' : 'gray';
  tray.setImage(createIcon(color));
}
