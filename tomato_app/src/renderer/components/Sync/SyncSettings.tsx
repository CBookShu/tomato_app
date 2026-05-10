import { useEffect } from 'react';
import { useSyncStore } from '@/stores/sync-store.js';

const statusConfig = {
  idle: { icon: '⏸️', text: '未同步', color: 'text-gray-500' },
  syncing: { icon: '🔄', text: '同步中...', color: 'text-blue-500' },
  synced: { icon: '✅', text: '已同步', color: 'text-green-500' },
  conflict: { icon: '⚠️', text: '有冲突', color: 'text-yellow-500' },
  offline: { icon: '📴', text: '离线', color: 'text-gray-400' },
  error: { icon: '❌', text: '同步失败', color: 'text-red-500' },
};

export function SyncSettings() {
  const isLoggedIn = useSyncStore((s) => s.isLoggedIn);
  const status = useSyncStore((s) => s.status);
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime);
  const dataDir = useSyncStore((s) => s.dataDir);
  const error = useSyncStore((s) => s.error);
  const conflictBranch = useSyncStore((s) => s.conflictBranch);
  const login = useSyncStore((s) => s.login);
  const logout = useSyncStore((s) => s.logout);
  const sync = useSyncStore((s) => s.sync);
  const getStatus = useSyncStore((s) => s.getStatus);
  const getDataDir = useSyncStore((s) => s.getDataDir);

  useEffect(() => {
    void getStatus();
    void getDataDir();
  }, [getStatus, getDataDir]);

  const handleLogin = async () => {
    try {
      await login();
    } catch {
      // Error is already handled in store
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Error is already handled in store
    }
  };

  const handleSync = async () => {
    try {
      await sync();
    } catch {
      // Error is already handled in store
    }
  };

  const config = statusConfig[status];

  const formatLastSyncTime = (time: string | null): string => {
    if (!time) return '从未';
    return new Date(time).toLocaleString();
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-lg font-semibold">同步设置</h2>

      {/* GitHub 账户 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">GitHub 账户</h3>
        {isLoggedIn ? (
          <div className="flex items-center justify-between">
            <span className="text-green-600 flex items-center gap-1">
              <span>✓</span>
              <span>已登录</span>
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              登出
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            className="px-4 py-2 text-sm bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors"
          >
            使用 GitHub 登录
          </button>
        )}
      </div>

      {/* 同步状态 */}
      {isLoggedIn && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">同步状态</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1 ${config.color}`}>
                <span>{config.icon}</span>
                <span className="text-sm">{config.text}</span>
              </span>
              {status === 'synced' && lastSyncTime && (
                <span className="text-xs text-gray-400">
                  上次同步: {formatLastSyncTime(lastSyncTime)}
                </span>
              )}
            </div>
            <button
              onClick={handleSync}
              disabled={status === 'syncing'}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              立即同步
            </button>
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="p-2 text-sm text-red-600 bg-red-50 rounded">
              {error}
            </div>
          )}

          {/* 冲突提示 */}
          {status === 'conflict' && conflictBranch && (
            <div className="p-2 text-sm text-yellow-700 bg-yellow-50 rounded">
              检测到冲突分支: {conflictBranch}，请手动解决冲突
            </div>
          )}
        </div>
      )}

      {/* 数据目录 */}
      {dataDir && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">数据目录</h3>
          <code className="block p-2 text-xs bg-gray-100 rounded break-all">
            {dataDir}
          </code>
        </div>
      )}
    </div>
  );
}
