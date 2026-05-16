import { contextBridge, ipcRenderer } from 'electron';

// Sync channel constants (duplicated to avoid import issues)
const SYNC = {
  BIND_REPOSITORY: 'sync:bind-repository',
  UNBIND_REPOSITORY: 'sync:unbind-repository',
  GET_STATUS: 'sync:get-status',
  SYNC: 'sync:sync',
  RESOLVE_CONFLICT: 'sync:resolve-conflict',
  ROLLBACK: 'sync:rollback',
  GET_DATA_DIR: 'sync:get-data-dir',
} as const;

const UPDATE = {
  GET_STATUS: 'update:get-status',
  CHECK_FOR_UPDATES: 'update:check-for-updates',
  OPEN_RELEASE: 'update:open-release',
} as const;

const api = {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  // Sync-specific API for convenience
  sync: {
    bindRepository: (remoteUrl: string, remoteBranch: string) =>
      ipcRenderer.invoke(SYNC.BIND_REPOSITORY, { remoteUrl, remoteBranch }),
    unbindRepository: () => ipcRenderer.invoke(SYNC.UNBIND_REPOSITORY),
    getStatus: () => ipcRenderer.invoke(SYNC.GET_STATUS),
    sync: () => ipcRenderer.invoke(SYNC.SYNC),
    resolveConflict: () => ipcRenderer.invoke(SYNC.RESOLVE_CONFLICT),
    rollback: () => ipcRenderer.invoke(SYNC.ROLLBACK),
    getDataDir: () => ipcRenderer.invoke(SYNC.GET_DATA_DIR),
  },
  update: {
    getStatus: () => ipcRenderer.invoke(UPDATE.GET_STATUS),
    checkForUpdates: (options: { force?: boolean } = {}) =>
      ipcRenderer.invoke(UPDATE.CHECK_FOR_UPDATES, options),
    openRelease: () => ipcRenderer.invoke(UPDATE.OPEN_RELEASE),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
