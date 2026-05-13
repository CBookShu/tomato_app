import { contextBridge, ipcRenderer } from 'electron';

// Sync channel constants (duplicated to avoid import issues)
const SYNC = {
  LOGIN: 'sync:login',
  LOGOUT: 'sync:logout',
  BIND_REPOSITORY: 'sync:bind-repository',
  UNBIND_REPOSITORY: 'sync:unbind-repository',
  GET_STATUS: 'sync:get-status',
  SYNC: 'sync:sync',
  RESOLVE_CONFLICT: 'sync:resolve-conflict',
  ROLLBACK: 'sync:rollback',
  GET_DATA_DIR: 'sync:get-data-dir',
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
    login: () => ipcRenderer.invoke(SYNC.LOGIN),
    logout: () => ipcRenderer.invoke(SYNC.LOGOUT),
    bindRepository: (repositoryUrl: string) => ipcRenderer.invoke(SYNC.BIND_REPOSITORY, { repositoryUrl }),
    unbindRepository: () => ipcRenderer.invoke(SYNC.UNBIND_REPOSITORY),
    getStatus: () => ipcRenderer.invoke(SYNC.GET_STATUS),
    sync: () => ipcRenderer.invoke(SYNC.SYNC),
    resolveConflict: () => ipcRenderer.invoke(SYNC.RESOLVE_CONFLICT),
    rollback: () => ipcRenderer.invoke(SYNC.ROLLBACK),
    getDataDir: () => ipcRenderer.invoke(SYNC.GET_DATA_DIR),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
