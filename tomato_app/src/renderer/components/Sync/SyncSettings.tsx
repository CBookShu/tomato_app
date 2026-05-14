import { useEffect, useState } from 'react';
import { useSyncStore } from '@/stores/sync-store.js';
import { RepositoryField } from '@/components/Sync/RepositoryField.js';
import { SyncBindingStatus } from '@/components/Sync/SyncBindingStatus.js';
import { SyncStatus } from '@/components/Sync/SyncStatus.js';

export function SyncSettings() {
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteBranch, setRemoteBranch] = useState('');

  const status = useSyncStore((s) => s.status);
  const repositoryUrlFromStore = useSyncStore((s) => s.repositoryUrl);
  const remoteBranchFromStore = useSyncStore((s) => s.remoteBranch);
  const error = useSyncStore((s) => s.error);
  const dataDir = useSyncStore((s) => s.dataDir);
  const bindRepository = useSyncStore((s) => s.bindRepository);
  const getStatus = useSyncStore((s) => s.getStatus);
  const getDataDir = useSyncStore((s) => s.getDataDir);

  useEffect(() => {
    async function init() {
      try {
        await Promise.all([getStatus(), getDataDir()]);
      } catch (e) {
        console.error('SyncSettings init error:', e);
      }
    }

    init();
  }, [getStatus, getDataDir]);

  useEffect(() => {
    setRemoteUrl(repositoryUrlFromStore ?? '');
  }, [repositoryUrlFromStore]);

  useEffect(() => {
    setRemoteBranch(remoteBranchFromStore ?? '');
  }, [remoteBranchFromStore]);

  const handleBind = async () => {
    const trimmedUrl = remoteUrl.trim();
    const trimmedBranch = remoteBranch.trim();
    if (!trimmedUrl || !trimmedBranch) return;

    try {
      await bindRepository(trimmedUrl, trimmedBranch);
    } catch {
      // Error is already stored for display.
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        先确认本机已经可以访问目标 Git 远程，然后填写远程地址和目标分支完成绑定。
      </p>

      <RepositoryField
        remoteUrl={remoteUrl}
        remoteBranch={remoteBranch}
        onRemoteUrlChange={setRemoteUrl}
        onRemoteBranchChange={setRemoteBranch}
        onSubmit={handleBind}
        disabled={status === 'syncing'}
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <SyncBindingStatus />

      <SyncStatus />

      {dataDir && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            数据目录
          </h4>
          <code className="block rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-700 break-all dark:bg-gray-900 dark:text-gray-300">
            {dataDir}
          </code>
        </div>
      )}
    </div>
  );
}
