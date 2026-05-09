import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import { safeSend } from './safe-send.js';

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let currentTaskTitle: string | undefined = undefined;

export type TimerStatus = 'idle' | 'working' | 'paused' | 'breaking' | 'long-break';

// 缓存已生成的图标，避免每秒重建
const iconCache = new Map<string, Electron.NativeImage>();

/**
 * 程序化绘制带颜色的托盘图标
 * 不依赖文件系统，直接用 RGBA 像素绘制
 */
function drawTrayIcon(status: TimerStatus): Electron.NativeImage {
  const cacheKey = status;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const size = 22; // macOS 菜单栏推荐 22x22（含 @2x 为 44x44）
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 9;

  // 颜色映射 (RGBA)
  const colors: Record<string, { r: number; g: number; b: number }> = {
    idle: { r: 128, g: 128, b: 128 },      // 灰色
    working: { r: 239, g: 68, b: 68 },      // 红色 (番茄)
    paused: { r: 251, g: 191, b: 36 },      // 黄色 (暂停)
    breaking: { r: 34, g: 197, b: 94 },     // 绿色 (休息)
    'long-break': { r: 34, g: 197, b: 94 }, // 绿色 (长休息)
  };

  const color = colors[status] || colors.idle;
  const canvas = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius - 0.5) {
        // 完全在圆内 - 填充颜色
        canvas[idx] = color.r;
        canvas[idx + 1] = color.g;
        canvas[idx + 2] = color.b;
        canvas[idx + 3] = 255;
      } else if (distance <= radius + 0.5) {
        // 边缘 - 抗锯齿
        const alpha = Math.round(255 * (1 - (distance - radius + 0.5)));
        canvas[idx] = color.r;
        canvas[idx + 1] = color.g;
        canvas[idx + 2] = color.b;
        canvas[idx + 3] = alpha;
      }
      // 圆外保持透明
    }
  }

  const image = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  iconCache.set(cacheKey, image);
  return image;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  mainWindow = getWindow();
  const icon = drawTrayIcon('idle');
  tray = new Tray(icon);
  tray.setToolTip('Tomato - 就绪');

  // 双击打开/聚焦窗口
  tray.on('double-click', () => {
    const win = mainWindow || getWindow();
    if (win) {
      win.show();
      win.focus();
    }
  });

  // 单击切换窗口可见性
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

  // 根据状态添加操作按钮
  if (status === 'working') {
    menuItems.push({
      label: '⏸ 暂停',
      click: () => safeSend(mainWindow, IPC.TRAY_PAUSE),
    });
    menuItems.push({
      label: '⏹ 停止',
      click: () => safeSend(mainWindow, IPC.TRAY_STOP),
    });
  } else if (status === 'breaking' || status === 'long-break') {
    menuItems.push({
      label: '⏭ 跳过休息',
      click: () => safeSend(mainWindow, IPC.TRAY_SKIP_BREAK),
    });
    menuItems.push({
      label: '⏹ 停止',
      click: () => safeSend(mainWindow, IPC.TRAY_STOP),
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

  const icon = drawTrayIcon(status);
  tray.setImage(icon);

  const statusLabels: Record<string, string> = {
    idle: '就绪',
    working: '专注中',
    paused: '已暂停',
    breaking: '短休息',
    'long-break': '长休息',
  };

  const timeStr = remainingTime && remainingTime > 0 ? formatTime(remainingTime) : '';
  const timeDisplay = timeStr ? ` ${timeStr}` : '';

  // macOS: 在托盘图标旁边显示倒计时
  if (process.platform === 'darwin') {
    if (timeStr && status !== 'idle') {
      tray.setTitle(timeStr);
    } else {
      tray.setTitle('');
    }
  }

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
