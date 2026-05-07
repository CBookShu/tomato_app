import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let currentTaskTitle: string | undefined = undefined;

export type TimerStatus = 'idle' | 'working' | 'paused' | 'breaking' | 'long-break';

/**
 * 加载预制 Template Image 图标
 * macOS Template Image 规范：
 * - 黑色轮廓 + alpha 通道
 * - 文件名以 Template 结尾
 * - 系统自动适配深浅主题
 * - Electron 自动加载 @2x 版本用于 Retina 屏幕
 */
function loadTrayIcon(status: TimerStatus): Electron.NativeImage {
  const iconName = status === 'breaking' || status === 'long-break' ? 'breaking' :
                   status === 'working' ? 'working' :
                   status === 'paused' ? 'paused' : 'idle';

  const iconsDir = path.join(__dirname, '..', '..', 'resources', 'icons');
  // 只传递基本文件名，Electron 会自动查找 @2x 版本
  const iconPath = path.join(iconsDir, `${iconName}Template.png`);

  // 检查图标文件是否存在
  if (fs.existsSync(iconPath)) {
    const image = nativeImage.createFromPath(iconPath);
    // 设置为模板图标，macOS 会自动根据主题调整颜色
    image.setTemplateImage(true);
    return image;
  }

  // Fallback: 创建简单的黑色模板图标
  return createFallbackTemplateIcon();
}

/**
 * Fallback: 创建简单的黑色圆形模板图标
 */
function createFallbackTemplateIcon(): Electron.NativeImage {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  // 绘制黑色圆形（Template Image 标准）
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius - 0.5) {
        // 完全在圆内 - 黑色不透明
        canvas[idx] = 0;
        canvas[idx + 1] = 0;
        canvas[idx + 2] = 0;
        canvas[idx + 3] = 255;
      } else if (distance <= radius + 0.5) {
        // 边缘 - 抗锯齿
        const alpha = Math.round(255 * (1 - (distance - radius + 0.5)));
        canvas[idx] = 0;
        canvas[idx + 1] = 0;
        canvas[idx + 2] = 0;
        canvas[idx + 3] = alpha;
      }
      // 圆外保持透明（alpha = 0）
    }
  }

  const image = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  image.setTemplateImage(true);
  return image;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  mainWindow = getWindow();
  const icon = loadTrayIcon('idle');
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

  const icon = loadTrayIcon(status);
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
