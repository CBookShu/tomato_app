import { create } from 'zustand';
import type { SyncResult, SyncStatus } from '@pomodoro/core';

interface SyncState {
  status: SyncStatus;
  isBound: boolean;
  repositoryUrl: string | null;
  remoteLabel: string | null;
  remoteBranch: string | null;
  boundAt: string | null;
  updatedAt: string | null;
  lastSyncTime: string | null;
  error: string | null;
  conflictBranch: string | null;
  dataDir: string | null;
}

interface SyncStatusSnapshot {
  isBound: boolean;
  repositoryUrl: string | null;
  remoteLabel?: string | null;
  remoteBranch: string | null;
  boundAt: string | null;
  updatedAt: string | null;
  syncStatus: SyncStatus;
  lastSyncTime: string | null;
  error: string | null;
  conflictBranch: string | null;
}

interface SyncActions {
  bindRepository: (repositoryUrl: string, remoteBranch: string) => Promise<SyncResult>;
  unbindRepository: () => Promise<void>;
  sync: () => Promise<SyncResult>;
  resolveConflict: () => Promise<SyncResult>;
  rollback: () => Promise<void>;
  getStatus: () => Promise<void>;
  getDataDir: () => Promise<void>;
  reset: () => void;
}

const initialState: SyncState = {
  status: 'idle',
  isBound: false,
  repositoryUrl: null,
  remoteLabel: null,
  remoteBranch: null,
  boundAt: null,
  updatedAt: null,
  lastSyncTime: null,
  error: null,
  conflictBranch: null,
  dataDir: null,
};

function getSyncBridge() {
  if (typeof window === 'undefined' || !window.electronAPI?.sync) {
    throw new Error('Sync bridge is not available');
  }

  return window.electronAPI.sync;
}

function buildStateFromSnapshot(snapshot: SyncStatusSnapshot): Partial<SyncState> {
  return {
    isBound: snapshot.isBound,
    repositoryUrl: snapshot.repositoryUrl,
    remoteLabel: snapshot.remoteLabel ?? snapshot.repositoryUrl,
    remoteBranch: snapshot.remoteBranch,
    boundAt: snapshot.boundAt,
    updatedAt: snapshot.updatedAt,
    status: snapshot.syncStatus || 'idle',
    lastSyncTime: snapshot.lastSyncTime,
    error: snapshot.error,
    conflictBranch: snapshot.conflictBranch,
  };
}

function preserveDataDir(state: SyncState): SyncState {
  return {
    ...initialState,
    dataDir: state.dataDir,
  };
}

export const useSyncStore = create<SyncState & SyncActions>((set, get) => ({
  ...initialState,

  bindRepository: async (repositoryUrl: string, remoteBranch: string) => {
    try {
      set({ status: 'syncing', error: null });
      const result: SyncResult = await getSyncBridge().bindRepository(repositoryUrl, remoteBranch);

      if (result.success) {
        await get().getStatus();
      } else if (result.status === 'conflict') {
        await get().getStatus();
      } else {
        set({
          status: 'error',
          error: result.error || 'Repository binding failed',
        });
      }

      return result;
    } catch (error) {
      set({ status: 'error', error: (error as Error).message });
      throw error;
    }
  },

  unbindRepository: async () => {
    try {
      await getSyncBridge().unbindRepository();
      set((state) => preserveDataDir(state));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  sync: async () => {
    try {
      set({ status: 'syncing', error: null });
      const result: SyncResult = await getSyncBridge().sync();

      if (result.success) {
        const now = new Date().toISOString();
        set({
          status: 'synced',
          updatedAt: now,
          lastSyncTime: now,
          error: null,
          conflictBranch: null,
        });
      } else if (result.status === 'conflict') {
        await get().getStatus();
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

  resolveConflict: async () => {
    try {
      set({ status: 'syncing', error: null });
      const result: SyncResult = await getSyncBridge().resolveConflict();

      if (result.success) {
        const now = new Date().toISOString();
        set({
          status: 'synced',
          updatedAt: now,
          lastSyncTime: now,
          error: null,
          conflictBranch: null,
        });
      } else if (result.status === 'conflict') {
        await get().getStatus();
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

  rollback: async () => {
    try {
      await getSyncBridge().rollback();
      await get().getStatus();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  getStatus: async () => {
    try {
      const snapshot = await getSyncBridge().getStatus();
      set(buildStateFromSnapshot(snapshot));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  getDataDir: async () => {
    try {
      const dataDir = await getSyncBridge().getDataDir();
      set({ dataDir });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  reset: () => set((state) => preserveDataDir(state)),
}));
