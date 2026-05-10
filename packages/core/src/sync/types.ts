// packages/core/src/sync/types.ts
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'conflict' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncTime?: string;
  error?: string;
  conflictBranch?: string;
}

export interface SyncResult {
  success: boolean;
  status: SyncStatus;
  error?: string;
  conflictBranch?: string;
}

export interface ConflictInfo {
  branchName: string;
  files: string[];
}