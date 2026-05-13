import { Button } from '@/components/ui/button.js';
import { useSyncStore } from '@/stores/sync-store.js';

const statusConfig = {
  idle: { icon: '⏸️', text: '未同步', color: 'text-gray-500' },
  syncing: { icon: '🔄', text: '同步中...', color: 'text-blue-500' },
  synced: { icon: '✅', text: '已同步', color: 'text-green-500' },
  conflict: { icon: '⚠️', text: '有冲突', color: 'text-yellow-500' },
  offline: { icon: '📴', text: '离线', color: 'text-gray-400' },
  error: { icon: '❌', text: '同步失败', color: 'text-red-500' },
} as const;

function formatLastSyncTime(time: string | null): string {
  if (!time) return '从未同步';
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return time;
  return date.toLocaleString();
}

export function SyncStatus() {
  const status = useSyncStore((s) => s.status);
  const isLoggedIn = useSyncStore((s) => s.isLoggedIn);
  const isBound = useSyncStore((s) => s.isBound);
  const repositoryOwner = useSyncStore((s) => s.repositoryOwner);
  const repositoryName = useSyncStore((s) => s.repositoryName);
  const remoteBranch = useSyncStore((s) => s.remoteBranch);
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime);
  const error = useSyncStore((s) => s.error);
  const sync = useSyncStore((s) => s.sync);

  const config = statusConfig[status];
  const repoLabel = repositoryOwner && repositoryName ? `${repositoryOwner}/${repositoryName}` : '未绑定仓库';
  const branchLabel = remoteBranch || 'main';

  const handleSync = async () => {
    if (status === 'syncing' || !isLoggedIn || !isBound) return;

    try {
      await sync();
    } catch {
      // Error is already handled in store.
    }
  };

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`flex items-center gap-1 text-sm ${config.color}`}>
              <span>{config.icon}</span>
              <span>{config.text}</span>
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {repoLabel} · {branchLabel}
            </span>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {status === 'conflict'
              ? '冲突已保存在备份分支中，处理完成后可继续同步。'
              : isBound
                ? `上次同步: ${formatLastSyncTime(lastSyncTime)}`
                : '先绑定仓库后才能同步。'}
          </p>
        </div>

        <Button
          onClick={handleSync}
          size="sm"
          disabled={status === 'syncing' || !isLoggedIn || !isBound}
          variant={status === 'error' ? 'destructive' : 'default'}
        >
          立即同步
        </Button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-500" title={error}>
          {error}
        </p>
      )}
    </div>
  );
}
