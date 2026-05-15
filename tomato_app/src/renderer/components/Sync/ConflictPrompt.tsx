import { Button } from '@/components/ui/button.js';
import { useSyncStore } from '@/stores/sync-store.js';

interface ConflictPromptProps {
  onClose?: () => void;
}

function formatTimestamp(value: string | null): string {
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function ConflictPrompt({ onClose }: ConflictPromptProps) {
  const status = useSyncStore((s) => s.status);
  const conflictBranch = useSyncStore((s) => s.conflictBranch);
  const repositoryUrl = useSyncStore((s) => s.repositoryUrl);
  const remoteLabel = useSyncStore((s) => s.remoteLabel);
  const remoteBranch = useSyncStore((s) => s.remoteBranch);
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime);
  const dataDir = useSyncStore((s) => s.dataDir);
  const resolveConflict = useSyncStore((s) => s.resolveConflict);

  if (status !== 'conflict' || !conflictBranch) {
    return null;
  }

  const handleResolveManually = async () => {
    try {
      await resolveConflict();
      onClose?.();
    } catch (error) {
      console.error('Conflict resolution failed:', error);
    }
  };

  const repoLabel = remoteLabel || repositoryUrl || '未绑定远程';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2 className="mb-2 text-lg font-semibold text-yellow-600">⚠️ 同步冲突</h2>

        <p className="mb-4 text-gray-600 dark:text-gray-300">
          {repoLabel} 在 <span className="font-medium">{remoteBranch || 'main'}</span> 上出现冲突。
          本地工作区已保留，当前需要先在这份工作区里手动解决冲突，再继续同步。
        </p>

        <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/60">
          <div>
            <span className="text-gray-500 dark:text-gray-400">冲突备份分支（仅保留，不建议直接 merge）：</span>
            <div className="font-mono text-gray-800 dark:text-gray-100">{conflictBranch}</div>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">最近同步：</span>
            <div className="text-gray-800 dark:text-gray-100">{formatTimestamp(lastSyncTime)}</div>
          </div>
          {dataDir && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">数据目录：</span>
              <div className="break-all font-mono text-gray-800 dark:text-gray-100">{dataDir}</div>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <p>处理顺序很简单：</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              打开数据目录里的仓库，运行 <span className="font-mono">git status</span> 看哪些文件冲突。
            </li>
            <li>
              在当前工作区修改这些文件，删掉冲突标记并保留你想要的内容。
            </li>
            <li>
              运行 <span className="font-mono">git add .</span>，然后 <span className="font-mono">git commit</span> 完成这次合并。
            </li>
            <li>回到 App，点击“手动处理后继续同步”。</li>
          </ol>
        </div>

        <div className="mt-6">
          <Button onClick={handleResolveManually} variant="outline" className="w-full">
            手动处理后继续同步
          </Button>
        </div>

        <p className="mt-4 text-xs text-gray-400">提示：备份分支只是保险，不建议直接拿它去 merge。</p>
      </div>
    </div>
  );
}
