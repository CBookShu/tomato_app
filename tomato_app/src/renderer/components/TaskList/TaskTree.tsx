import { useTaskStore } from '@/stores/task-store.js';
import { TaskGroupItem } from './TaskGroupItem.js';
import { Button } from '@/components/ui/button.js';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';

export function TaskTree() {
  const groups = useTaskStore((s) => s.groups);
  const getTasksByGroup = useTaskStore((s) => s.getTasksByGroup);
  const addGroup = useTaskStore((s) => s.addGroup);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    if (name) {
      addGroup({
        id: crypto.randomUUID(),
        name,
        taskOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setNewGroupName('');
      setDialogOpen(false);
    }
  };

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
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
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
    </div>
  );
}
