import { useEffect, useState } from 'react';
import { useSyncStore } from '@/stores/sync-store.js';
import { RepositoryField } from '@/components/Sync/RepositoryField.js';
import { SyncBindingStatus } from '@/components/Sync/SyncBindingStatus.js';
import { SyncStatus } from '@/components/Sync/SyncStatus.js';

export function SyncSettings() {
  const [repositoryUrl, setRepositoryUrl] = useState('');

  const isLoggedIn = useSyncStore((s) => s.isLoggedIn);
  const isBound = useSyncStore((s) => s.isBound);
  const status = useSyncStore((s) => s.status);
  const repositoryUrlFromStore = useSyncStore((s) => s.repositoryUrl);
  const error = useSyncStore((s) => s.error);
  const dataDir = useSyncStore((s) => s.dataDir);
  const bindRepository = useSyncStore((s) => s.bindRepository);
  const unbindRepository = useSyncStore((s) => s.unbindRepository);
  const login = useSyncStore((s) => s.login);
  const logout = useSyncStore((s) => s.logout);
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
    setRepositoryUrl(repositoryUrlFromStore ?? '');
  }, [repositoryUrlFromStore]);

  const handleBind = async () => {
    const trimmed = repositoryUrl.trim();
    if (!trimmed) return;

    try {
      await bindRepository(trimmed);
    } catch {
      // Error is already stored for display.
    }
  };

  const handleLogin = async () => {
    try {
      await login();
    } catch {
      // Error is already stored for display.
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Error is already stored for display.
    }
  };

  const handleUnbind = async () => {
    try {
      await unbindRepository();
    } catch {
      // Error is already stored for display.
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        先登录 GitHub，再粘贴仓库地址绑定。绑定后即可通过同一仓库进行同步，空仓库会在后台自动初始化。
      </p>

      <RepositoryField
        value={repositoryUrl}
        onChange={setRepositoryUrl}
        onSubmit={handleBind}
        disabled={status === 'syncing'}
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <SyncBindingStatus
        isLoggedIn={isLoggedIn}
        isBound={isBound}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onUnbind={handleUnbind}
      />

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
