import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { useSyncStore } from '@/stores/sync-store.js';

function formatTimestamp(value: string | null): string {
  if (!value) return '暂无';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export function SyncBindingStatus() {
  const isBound = useSyncStore((s) => s.isBound);
  const repositoryUrl = useSyncStore((s) => s.repositoryUrl);
  const remoteLabel = useSyncStore((s) => s.remoteLabel);
  const remoteBranch = useSyncStore((s) => s.remoteBranch);
  const boundAt = useSyncStore((s) => s.boundAt);
  const updatedAt = useSyncStore((s) => s.updatedAt);
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime);
  const conflictBranch = useSyncStore((s) => s.conflictBranch);
  const unbindRepository = useSyncStore((s) => s.unbindRepository);

  const remoteDisplay = remoteLabel || repositoryUrl || '未配置远程';

  const handleUnbind = async () => {
    try {
      await unbindRepository();
    } catch {
      // Error is already stored for display.
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-sm font-medium">绑定状态</CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              这里展示当前远程地址、目标分支和最近一次同步时间。
            </p>
          </div>

          {isBound && (
            <Button size="sm" variant="destructive" onClick={handleUnbind}>
              解绑
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2 py-1 ${
              isBound
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {isBound ? '已绑定' : '未绑定'}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {remoteDisplay}
          </span>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">远程地址</dt>
            <dd className="break-all text-gray-700 dark:text-gray-300">{repositoryUrl || '尚未绑定'}</dd>
          </div>

          <div className="space-y-1">
            <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">远程分支</dt>
            <dd className="text-gray-700 dark:text-gray-300">{remoteBranch || 'main'}</dd>
          </div>

          <div className="space-y-1">
            <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">绑定时间</dt>
            <dd className="text-gray-700 dark:text-gray-300">{formatTimestamp(boundAt)}</dd>
          </div>

          <div className="space-y-1">
            <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">最近更新</dt>
            <dd className="text-gray-700 dark:text-gray-300">{formatTimestamp(updatedAt)}</dd>
          </div>

          <div className="space-y-1">
            <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">最近同步</dt>
            <dd className="text-gray-700 dark:text-gray-300">{formatTimestamp(lastSyncTime)}</dd>
          </div>
        </dl>

        {conflictBranch && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-900/40 dark:bg-yellow-950/30 dark:text-yellow-200">
            冲突备份分支: <span className="font-mono">{conflictBranch}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
