import { create } from 'zustand';
import type { SyncResult, SyncStatus } from '@pomodoro/core';

interface SyncState {
  status: SyncStatus;
  isLoggedIn: boolean;
  isBound: boolean;
  repositoryUrl: string | null;
  repositoryOwner: string | null;
  repositoryName: string | null;
  remoteName: string | null;
  remoteBranch: string | null;
  boundAt: string | null;
  updatedAt: string | null;
  lastSyncTime: string | null;
  error: string | null;
  conflictBranch: string | null;
  dataDir: string | null;
}

interface SyncStatusSnapshot {
  isLoggedIn: boolean;
  isBound: boolean;
  repositoryUrl: string | null;
  repositoryOwner: string | null;
  repositoryName: string | null;
  remoteName: string | null;
  remoteBranch: string | null;
  boundAt: string | null;
  updatedAt: string | null;
  syncStatus: SyncStatus;
  lastSyncTime: string | null;
  error: string | null;
  conflictBranch: string | null;
}

interface SyncActions {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  bindRepository: (repositoryUrl: string) => Promise<SyncResult>;
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
  isLoggedIn: false,
  isBound: false,
  repositoryUrl: null,
  repositoryOwner: null,
  repositoryName: null,
  remoteName: null,
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
    isLoggedIn: snapshot.isLoggedIn,
    isBound: snapshot.isBound,
    repositoryUrl: snapshot.repositoryUrl,
    repositoryOwner: snapshot.repositoryOwner,
    repositoryName: snapshot.repositoryName,
    remoteName: snapshot.remoteName,
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

  login: async () => {
    try {
      set({ status: 'syncing', error: null });
      await getSyncBridge().login();
      await get().getStatus();
    } catch (error) {
      set({ status: 'error', error: (error as Error).message });
      throw error;
    }
  },

  logout: async () => {
    try {
      await getSyncBridge().logout();
      set((state) => preserveDataDir(state));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  bindRepository: async (repositoryUrl: string) => {
    try {
      set({ status: 'syncing', error: null });
      const result: SyncResult = await getSyncBridge().bindRepository(repositoryUrl);

      if (result.success) {
        await get().getStatus();
      } else if (result.status === 'conflict') {
        set({
          status: 'conflict',
          conflictBranch: result.conflictBranch || null,
          error: null,
        });
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
        set({
          status: 'conflict',
          conflictBranch: result.conflictBranch || null,
          error: null,
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
        set({
          status: 'conflict',
          conflictBranch: result.conflictBranch || null,
          error: null,
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
