import { useEffect } from 'react';
import { Button } from '@/components/ui/button.js';
import { useUpdateStore } from '@/stores/update-store.js';

function formatTimestamp(value: string | null): string {
  if (!value) return '暂无';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

const statusConfig = {
  idle: { text: '尚未检查', color: 'text-gray-500' },
  checking: { text: '检查中...', color: 'text-blue-500' },
  available: { text: '发现新版本', color: 'text-emerald-600' },
  'up-to-date': { text: '已是最新', color: 'text-green-600' },
  error: { text: '检查失败', color: 'text-red-500' },
} as const;

export function UpdateSettings() {
  const status = useUpdateStore((s) => s.status);
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const releaseTag = useUpdateStore((s) => s.releaseTag);
  const releaseName = useUpdateStore((s) => s.releaseName);
  const releaseUrl = useUpdateStore((s) => s.releaseUrl);
  const lastCheckedAt = useUpdateStore((s) => s.lastCheckedAt);
  const error = useUpdateStore((s) => s.error);
  const getStatus = useUpdateStore((s) => s.getStatus);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const openRelease = useUpdateStore((s) => s.openRelease);

  useEffect(() => {
    async function init() {
      try {
        await getStatus();
      } catch (e) {
        console.error('UpdateSettings init error:', e);
      }
    }

    init();
  }, [getStatus]);

  const handlePrimaryAction = async () => {
    try {
      if (status === 'available' && releaseUrl) {
        await openRelease();
        return;
      }

      await checkForUpdates({ force: true });
    } catch {
      // Error is already stored for display.
    }
  };

  const statusLabel = statusConfig[status];
  const buttonLabel =
    status === 'checking'
      ? '检查中...'
      : status === 'available'
        ? '打开发布页'
        : status === 'error'
          ? '重新检查'
          : '检查更新';

  const latestLabel =
    status === 'available' && latestVersion
      ? `${latestVersion}${releaseTag ? ` (${releaseTag})` : ''}`
      : latestVersion || '尚未检查';

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        这里会从 GitHub Releases 检查新版本；发现更新后会跳到发布页，方便你手动下载和安装。
      </p>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">当前版本</dt>
          <dd className="text-gray-700 dark:text-gray-300">{currentVersion || '未知'}</dd>
        </div>

        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">最新版本</dt>
          <dd className="text-gray-700 dark:text-gray-300">{latestLabel}</dd>
        </div>

        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">检查状态</dt>
          <dd className={statusLabel.color}>{statusLabel.text}</dd>
        </div>

        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">最近检查</dt>
          <dd className="text-gray-700 dark:text-gray-300">{formatTimestamp(lastCheckedAt)}</dd>
        </div>
      </dl>

      {status === 'available' && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {releaseName ? <span className="mr-2 font-medium">{releaseName}</span> : null}
          <span className="font-mono">{releaseTag || latestVersion || '新版本可用'}</span>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handlePrimaryAction} disabled={status === 'checking'}>
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}
