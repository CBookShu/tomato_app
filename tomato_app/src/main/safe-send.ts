import { BrowserWindow } from 'electron';

/**
 * 安全地向渲染器发送 IPC 消息
 * 检查窗口是否存在且 webContents 未被销毁
 * 防止 "Object has been destroyed" 错误
 */
export function safeSend(win: BrowserWindow | null, channel: string, ...args: unknown[]): void {
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}
