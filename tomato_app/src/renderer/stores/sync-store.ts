import { create } from 'zustand';
import type { SyncStatus, SyncResult } from '@pomodoro/core';
import { IPC } from '@shared/ipc-channels.js';

interface SyncState {
  status: SyncStatus;
  isLoggedIn: boolean;
  lastSyncTime: string | null;
  error: string | null;
  conflictBranch: string | null;
  dataDir: string | null;
}

interface SyncActions {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  sync: () => Promise<SyncResult>;
  getStatus: () => Promise<void>;
  getDataDir: () => Promise<void>;
  reset: () => void;
}

const initialState: SyncState = {
  status: 'idle',
  isLoggedIn: false,
  lastSyncTime: null,
  error: null,
  conflictBranch: null,
  dataDir: null,
};

export const useSyncStore = create<SyncState & SyncActions>((set) => ({
  ...initialState,

  login: async () => {
    try {
      set({ status: 'syncing', error: null });
      await window.electronAPI.invoke(IPC.SYNC_LOGIN);
      set({ isLoggedIn: true, status: 'idle' });
    } catch (error) {
      set({ status: 'error', error: (error as Error).message });
      throw error;
    }
  },

  logout: async () => {
    try {
      await window.electronAPI.invoke(IPC.SYNC_LOGOUT);
      set({ ...initialState });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  sync: async () => {
    try {
      set({ status: 'syncing', error: null });
      const result: SyncResult = await window.electronAPI.invoke(IPC.SYNC_SYNC);

      if (result.success) {
        set({
          status: 'synced',
          lastSyncTime: new Date().toISOString(),
          error: null,
          conflictBranch: null,
        });
      } else if (result.status === 'conflict') {
        set({
          status: 'conflict',
          conflictBranch: result.conflictBranch || null,
        });
      } else {
        set({
          status: 'error',
          error: result.error || 'Sync failed',
        });
      }

      return result;
    } catch (error) {
      set({ status: 'error', error: (error as Error).message });
      throw error;
    }
  },

  getStatus: async () => {
    try {
      const status = await window.electronAPI.invoke(IPC.SYNC_GET_STATUS);
      set({
        isLoggedIn: status.isLoggedIn,
        status: (status.syncStatus as SyncStatus) || 'idle',
      });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  getDataDir: async () => {
    try {
      const dataDir = await window.electronAPI.invoke(IPC.SYNC_GET_DATA_DIR);
      set({ dataDir });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  reset: () => set(initialState),
}));
