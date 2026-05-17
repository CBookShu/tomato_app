import { useTaskStore } from '@/stores/task-store.js';
import { TaskGroupItem } from './TaskGroupItem.js';
import { Button } from '@/components/ui/button.js';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { useIpc } from '@/hooks/useIpc.js';
import {
  createGroupAndRehydrate,
  deleteGroupAndRehydrate,
  renameGroupAndRehydrate,
} from '@/lib/task-group-actions.js';

export function TaskTree() {
  const groups = useTaskStore((s) => s.groups);
  const getTasksByGroup = useTaskStore((s) => s.getTasksByGroup);
  const setTasks = useTaskStore((s) => s.setTasks);
  const setGroups = useTaskStore((s) => s.setGroups);
  const { invoke } = useIpc();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (name) {
      await createGroupAndRehydrate({
        invoke,
        setTasks,
        setGroups,
        input: { name },
      });
      setNewGroupName('');
      setDialogOpen(false);
    }
  };

  const handleRenameGroup = async (id: string, name: string) => {
    await renameGroupAndRehydrate({
      invoke,
      setTasks,
      setGroups,
      id,
      name,
    });
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupId) return;

    await deleteGroupAndRehydrate({
      invoke,
      setTasks,
      setGroups,
      id: deleteGroupId,
    });
    setDeleteGroupId(null);
  };

  const deleteGroupName = deleteGroupId ? groups.find((group) => group.id === deleteGroupId)?.name ?? '' : '';
  const deleteTaskCount = deleteGroupId ? getTasksByGroup(deleteGroupId).length : 0;

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">任务列表</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {groups.map((group) => (
          <TaskGroupItem
            key={group.id}
            group={group}
            tasks={getTasksByGroup(group.id)}
            onRename={(name) => handleRenameGroup(group.id, name)}
            onDelete={() => setDeleteGroupId(group.id)}
          />
        ))}
      </div>

      <div className="p-2 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-500"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          新建分组
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建分组</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="输入分组名称"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleCreateGroup();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateGroup}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteGroupId} onOpenChange={(open) => !open && setDeleteGroupId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除任务组</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            确定要删除「{deleteGroupName}」及其包含的 {deleteTaskCount} 个任务吗？
          </DialogDescription>
          <p className="text-sm text-muted-foreground">组内任务会迁移到「未分组」。</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteGroupId(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void handleDeleteGroup()}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
