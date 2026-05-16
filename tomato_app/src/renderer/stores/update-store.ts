import { create } from 'zustand';
import type { UpdateCheckOptions, UpdateSnapshot, UpdateStatus } from '@shared/app-update.js';

interface UpdateState {
  status: UpdateStatus;
  currentVersion: string | null;
  latestVersion: string | null;
  releaseTag: string | null;
  releaseName: string | null;
  releaseUrl: string | null;
  releaseNotes: string | null;
  lastCheckedAt: string | null;
  error: string | null;
}

interface UpdateActions {
  getStatus: () => Promise<void>;
  checkForUpdates: (options?: UpdateCheckOptions) => Promise<void>;
  openRelease: () => Promise<void>;
  reset: () => void;
}

const initialState: UpdateState = {
  status: 'idle',
  currentVersion: null,
  latestVersion: null,
  releaseTag: null,
  releaseName: null,
  releaseUrl: null,
  releaseNotes: null,
  lastCheckedAt: null,
  error: null,
};

function getUpdateBridge() {
  if (typeof window === 'undefined' || !window.electronAPI?.update) {
    throw new Error('Update bridge is not available');
  }

  return window.electronAPI.update;
}

function buildStateFromSnapshot(snapshot: UpdateSnapshot): Partial<UpdateState> {
  return {
    status: snapshot.status,
    currentVersion: snapshot.currentVersion,
    latestVersion: snapshot.latestVersion,
    releaseTag: snapshot.releaseTag,
    releaseName: snapshot.releaseName,
    releaseUrl: snapshot.releaseUrl,
    releaseNotes: snapshot.releaseNotes,
    lastCheckedAt: snapshot.lastCheckedAt,
    error: snapshot.error,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误';
}

export const useUpdateStore = create<UpdateState & UpdateActions>((set) => ({
  ...initialState,

  getStatus: async () => {
    try {
      const snapshot = await getUpdateBridge().getStatus();
      set(buildStateFromSnapshot(snapshot));
    } catch (error) {
      set({ status: 'error', error: getErrorMessage(error) });
    }
  },

  checkForUpdates: async (options: UpdateCheckOptions = {}) => {
    try {
      set({ status: 'checking', error: null });
      const snapshot = await getUpdateBridge().checkForUpdates(options);
      set(buildStateFromSnapshot(snapshot));
    } catch (error) {
      set({ status: 'error', error: getErrorMessage(error) });
    }
  },

  openRelease: async () => {
    try {
      await getUpdateBridge().openRelease();
    } catch (error) {
      set({ status: 'error', error: getErrorMessage(error) });
    }
  },

  reset: () => set(initialState),
}));
