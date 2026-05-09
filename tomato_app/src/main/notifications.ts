import { Notification, BrowserWindow, session } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import { safeSend } from './safe-send.js';

let mainWindow: BrowserWindow | null = null;

export function setNotificationWindow(win: BrowserWindow | null) {
  mainWindow = win;
}

interface NotificationAction {
  text: string;
  action: () => void;
}

export function sendNotification(
  title: string,
  body: string,
  actions?: NotificationAction[]
) {
  console.log('[Notification] Attempting to send:', title);

  if (!Notification.isSupported()) {
    console.warn('[Notification] Not supported on this system');
    return;
  }

  console.log('[Notification] Creating notification...');
  const notification = new Notification({
    title,
    body,
    silent: false,
    actions: actions?.map((a) => ({
      type: 'button' as const,
      text: a.text,
    })),
  });

  notification.on('action', (_event, index) => {
    console.log('[Notification] Action clicked:', index);
    actions?.[index]?.action();
  });

  notification.on('click', () => {
    console.log('[Notification] Clicked');
    notification.close();
  });

  notification.on('show', () => {
    console.log('[Notification] Shown successfully');
  });

  notification.show();
  console.log('[Notification] show() called');
}

export function notifyPomodoroComplete() {
  sendNotification('🍅 番茄时间结束', '该休息一下了！你完成了 1 个番茄钟。', [
    { text: '关闭', action: () => {} },
    {
      text: '打开应用',
      action: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
  ]);
  safeSend(mainWindow, IPC.PLAY_SOUND, 'pomodoro-end');
}

export function notifyBreakComplete() {
  sendNotification('☕ 休息时间结束', '可以继续专注了！', [
    { text: '关闭', action: () => {} },
    {
      text: '打开应用',
      action: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
  ]);
  safeSend(mainWindow, IPC.PLAY_SOUND, 'break-end');
}
