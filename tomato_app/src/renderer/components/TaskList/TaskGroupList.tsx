import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { TaskGroupHeader } from './TaskGroupHeader.js';
import { SortableTaskItem } from './SortableTaskItem.js';
import { TaskForm } from './TaskForm.js';
import { useTaskStore } from '@/stores/task-store.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { Plus } from 'lucide-react';
import { IPC } from '../../../shared/ipc-channels.js';
import { DEFAULT_GROUP_ID } from '@pomodoro/core';

export function TaskGroupList() {
  const groups = useTaskStore((s) => s.groups);
  const { getTasksByGroup, addTask, addGroup, removeGroup, updateGroup, reorderTaskInGroup } =
    useTaskStore();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDeleteGroup = async () => {
    if (!deleteGroupId) return;

    // 防止删除默认组
    if (deleteGroupId === DEFAULT_GROUP_ID) {
      setDeleteError('无法删除默认分组');
      return;
    }

    try {
      await window.electronAPI.invoke(IPC.GROUP_DELETE, { id: deleteGroupId });
      removeGroup(deleteGroupId);
      setDeleteGroupId(null);
      setDeleteError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败';
      setDeleteError(message);
    }
  };

  const handleDeleteRequest = (groupId: string) => {
    // 防止删除默认组
    if (groupId === DEFAULT_GROUP_ID) {
      setDeleteError('无法删除默认分组');
      setDeleteGroupId(groupId);
      return;
    }
    setDeleteGroupId(groupId);
    setDeleteError(null);
  };

  const getDeleteGroupName = () => {
    if (!deleteGroupId) return '';
    const group = groups.find((g) => g.id === deleteGroupId);
    return group?.name ?? '';
  };

  const getDeleteTaskCount = () => {
    if (!deleteGroupId) return 0;
    return getTasksByGroup(deleteGroupId).length;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !activeGroupId) {
      return;
    }

    const tasks = getTasksByGroup(activeGroupId);
    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      // Optimistic UI update
      reorderTaskInGroup(activeGroupId, oldIndex, newIndex);

      // Persist to database
      try {
        await window.electronAPI.invoke(IPC.TASK_REORDER, {
          taskId: String(active.id),
          newIndex,
        });
      } catch (error) {
        console.error('Failed to reorder task:', error);
        // Revert on error by reloading tasks
        // Could implement proper rollback if needed
      }
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
            onDelete={() => handleDeleteRequest(group.id)}
          />
          {!collapsed.has(group.id) && (
            <div className="ml-6">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={() => setActiveGroupId(group.id)}
                onDragEnd={(event) => {
                  handleDragEnd(event);
                  setActiveGroupId(null);
                }}
                onDragCancel={() => setActiveGroupId(null)}
              >
                <SortableContext
                  items={getTasksByGroup(group.id).map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {getTasksByGroup(group.id).map((task) => (
                    <SortableTaskItem key={task.id} task={task} />
                  ))}
                </SortableContext>
              </DndContext>
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

      {/* 删除确认对话框 */}
      <Dialog open={!!deleteGroupId} onOpenChange={(open) => !open && setDeleteGroupId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteError ? '错误' : '删除任务组'}
            </DialogTitle>
          </DialogHeader>
          {deleteError ? (
            <div className="py-4">
              <p className="text-red-500">{deleteError}</p>
            </div>
          ) : (
            <>
              <DialogDescription>
                确定要删除「{getDeleteGroupName()}」及其包含的 {getDeleteTaskCount()} 个任务吗？
              </DialogDescription>
              <p className="text-sm text-muted-foreground">此操作不可撤销。</p>
            </>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteGroupId(null)}>
              {deleteError ? '关闭' : '取消'}
            </Button>
            {!deleteError && (
              <Button variant="destructive" onClick={handleDeleteGroup}>
                删除
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
