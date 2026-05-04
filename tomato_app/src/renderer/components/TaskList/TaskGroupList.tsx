import { useState } from 'react';
import { TaskGroupHeader } from './TaskGroupHeader.js';
import { TaskItem } from './TaskItem.js';
import { TaskForm } from './TaskForm.js';
import { useTaskStore } from '@/stores/task-store.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { Plus } from 'lucide-react';

export function TaskGroupList() {
  const groups = useTaskStore((s) => s.groups);
  const { getTasksByGroup, addTask, addGroup, removeGroup, updateGroup } =
    useTaskStore();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

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
    <div className="flex flex-col gap-1">
      {groups.map((group) => (
        <div key={group.id}>
          <TaskGroupHeader
            group={group}
            tasks={getTasksByGroup(group.id)}
            collapsed={collapsed.has(group.id)}
            onToggle={() => toggle(group.id)}
            onAddTask={() => setAddingTo(group.id)}
            onRename={(name) => updateGroup(group.id, { name })}
            onDelete={() => removeGroup(group.id)}
          />
          {!collapsed.has(group.id) && (
            <div className="ml-6">
              {getTasksByGroup(group.id).map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                />
              ))}
              {addingTo === group.id && (
                <TaskForm
                  onSubmit={(title) => {
                    addTask({
                      id: crypto.randomUUID(),
                      title,
                      completedPomodoros: 0,
                      status: 'todo',
                      groupId: group.id,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    });
                    setAddingTo(null);
                  }}
                  onCancel={() => setAddingTo(null)}
                />
              )}
            </div>
          )}
        </div>
      ))}
      <Button variant="ghost" size="sm" className="self-start mt-2" onClick={() => setDialogOpen(true)}>
        <Plus className="h-4 w-4" />
        新建分组
      </Button>

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
