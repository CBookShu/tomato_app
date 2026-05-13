import { useSyncStore } from '@/stores/sync-store.js';

const statusConfig = {
  idle: { icon: '⏸️', text: '未同步', color: 'text-gray-500' },
  syncing: { icon: '🔄', text: '同步中...', color: 'text-blue-500' },
  synced: { icon: '✅', text: '已同步', color: 'text-green-500' },
  conflict: { icon: '⚠️', text: '有冲突', color: 'text-yellow-500' },
  offline: { icon: '📴', text: '离线', color: 'text-gray-400' },
  error: { icon: '❌', text: '同步失败', color: 'text-red-500' },
};

export function SyncStatus() {
  const status = useSyncStore((s) => s.status);
  const isLoggedIn = useSyncStore((s) => s.isLoggedIn);
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime);
  const error = useSyncStore((s) => s.error);
  const sync = useSyncStore((s) => s.sync);
  const config = statusConfig[status];

  const handleSync = async () => {
    if (status === 'syncing') return;
    try {
      await sync();
    } catch (e) {
      // Error is already handled in store
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span>未登录</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`flex items-center gap-1 ${config.color}`}>
        <span>{config.icon}</span>
        <span className="text-sm">{config.text}</span>
      </span>

      {status !== 'syncing' && (
        <button
          onClick={handleSync}
          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          同步
        </button>
      )}

      {lastSyncTime && status === 'synced' && (
        <span className="text-xs text-gray-400">
          {new Date(lastSyncTime).toLocaleTimeString()}
        </span>
      )}

      {error && (
        <span className="text-xs text-red-400" title={error}>
          错误
        </span>
      )}
    </div>
  );
}
