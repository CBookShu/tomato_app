import { useSyncStore } from '@/stores/sync-store.js';
import { IPC } from '@shared/ipc-channels.js';

interface ConflictPromptProps {
  onClose?: () => void;
}

export function ConflictPrompt({ onClose }: ConflictPromptProps) {
  const status = useSyncStore((s) => s.status);
  const conflictBranch = useSyncStore((s) => s.conflictBranch);
  const reset = useSyncStore((s) => s.reset);

  if (status !== 'conflict' || !conflictBranch) {
    return null;
  }

  const handleRollback = async () => {
    try {
      await window.electronAPI.invoke(IPC.SYNC_ROLLBACK);
      reset();
      onClose?.();
    } catch (error) {
      console.error('Rollback failed:', error);
    }
  };

  const handleResolveManually = () => {
    // 打开数据目录让用户手动处理
    reset();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-lg font-semibold text-yellow-600 mb-2">
          ⚠️ 同步冲突
        </h2>

        <p className="text-gray-600 mb-4">
          检测到远程和本地数据冲突。本地状态已保存到备份分支：
        </p>

        <code className="block p-2 mb-4 text-sm bg-gray-100 rounded text-gray-800 break-all">
          {conflictBranch}
        </code>

        <p className="text-gray-600 mb-6">请选择如何处理冲突：</p>

        <div className="space-y-3">
          <button
            onClick={handleRollback}
            className="w-full px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            回滚到远程版本
          </button>

          <button
            onClick={handleResolveManually}
            className="w-full px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            手动处理（保留本地版本）
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-400">
          提示：手动处理需要您在数据目录中解决冲突后再同步
        </p>
      </div>
    </div>
  );
}
