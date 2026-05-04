import { Notification } from 'electron';

export function sendNotification(title: string, body: string) {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title,
    body,
    silent: false,
  });

  notification.on('click', () => notification.close());
  notification.show();
}

export function notifyPomodoroComplete() {
  sendNotification('番茄时间结束', '该休息一下了！');
}

export function notifyBreakComplete() {
  sendNotification('休息时间结束', '可以继续专注了！');
}
