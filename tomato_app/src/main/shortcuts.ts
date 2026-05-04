import { globalShortcut } from 'electron';

export function registerShortcuts(handlers: {
  onStartPause: () => void;
  onStop: () => void;
  onNewTask: () => void;
}) {
  globalShortcut.register('CommandOrControl+Shift+P', handlers.onStartPause);
  globalShortcut.register('CommandOrControl+Shift+S', handlers.onStop);
  globalShortcut.register('CommandOrControl+Shift+N', handlers.onNewTask);
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}
