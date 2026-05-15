import { useTaskStore } from '@/stores/task-store.js';
import { useTimerStart } from '@/hooks/useTimerStart.js';
import { Button } from '@/components/ui/button.js';
import { Play, CheckCircle } from 'lucide-react';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useIpc } from '@/hooks/useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import MDEditor from '@uiw/react-md-editor';
import { useDebounce } from '@/hooks/useDebounce.js';
import { useTimerStore } from '@/stores/timer-store.js';
import { normalizeTaskNotes, shouldAutoSaveNotes } from '@/lib/task-notes.js';

const AUTO_SAVE_DELAY_MS = 500;

export function TaskDetail() {
  const tasks = useTaskStore((s) => s.tasks);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const updateTask = useTaskStore((s) => s.updateTask);
  const { start } = useTimerStart();
  const status = useTimerStore((s) => s.status);
  const { invoke } = useIpc();

  // Use useMemo to find the selected task
  const task = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  // Local state for notes editing
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedNotes, setLastSavedNotes] = useState<string | null>(null);
  const [isNotesLoaded, setIsNotesLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const notesSessionRef = useRef(0);
  const saveRequestRef = useRef(0);

  // Debounced notes for auto-save
  const debouncedNotes = useDebounce(notes, AUTO_SAVE_DELAY_MS);

  // Sync notes with selected task
  useEffect(() => {
    let cancelled = false;
    ++notesSessionRef.current;
    saveRequestRef.current = 0;

    if (task) {
      setNotes('');
      setLastSavedNotes(null);
      setIsNotesLoaded(false);
      setIsSaving(false);
      setSaveError(null);

      void (async () => {
        try {
          const currentNotes = normalizeTaskNotes(
            await invoke(IPC.NOTES_GET, { taskId: task.id }),
          );
          if (cancelled) {
            return;
          }
          setNotes(currentNotes);
          setLastSavedNotes(currentNotes);
        } catch (error) {
          if (cancelled) {
            return;
          }
          console.error('Failed to load notes:', error);
          setNotes('');
          setLastSavedNotes('');
        } finally {
          if (!cancelled) {
            setIsNotesLoaded(true);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    setNotes('');
    setLastSavedNotes(null);
    setIsNotesLoaded(false);
    setIsSaving(false);

    return () => {
      cancelled = true;
    };
  }, [task?.id, invoke]);

  useEffect(() => {
    setSaveError(null);
  }, [task?.id]);

  const handleSaveNotes = useCallback(async (taskId: string, value: string) => {
    const sessionId = notesSessionRef.current;
    const requestId = ++saveRequestRef.current;

    setIsSaving(true);
    setSaveError(null);
    try {
      await invoke(IPC.NOTES_SAVE, {
        taskId,
        content: value,
      });

      if (sessionId === notesSessionRef.current && requestId === saveRequestRef.current) {
        setLastSavedNotes(value);
      }
    } catch (error) {
      console.error('Failed to save notes:', error);
      if (sessionId === notesSessionRef.current && requestId === saveRequestRef.current) {
        setSaveError('保存失败');
      }
    } finally {
      if (sessionId === notesSessionRef.current && requestId === saveRequestRef.current) {
        setIsSaving(false);
      }
    }
  }, [invoke]);

  // Auto-save when debounced notes change
  useEffect(() => {
    const taskId = task?.id;
    if (!taskId || !shouldAutoSaveNotes(isNotesLoaded, lastSavedNotes, debouncedNotes)) {
      return;
    }
    void handleSaveNotes(taskId, debouncedNotes);
  }, [debouncedNotes, isNotesLoaded, lastSavedNotes, task?.id, handleSaveNotes]);

  if (!task) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-lg">选择一个任务查看详情</p>
          <p className="text-sm mt-1">或从左侧任务列表创建新任务</p>
        </div>
      </div>
    );
  }

  const handleStart = () => {
    start(task.id);
  };

  const handleComplete = async () => {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    const completedAt = task.status !== 'completed' ? new Date().toISOString() : undefined;

    // Optimistic UI update
    updateTask(task.id, {
      status: newStatus,
      completedAt,
    });

    // Persist to database
    try {
      if (newStatus === 'completed') {
        await invoke(IPC.TASK_COMPLETE, { id: task.id });
      } else {
        await invoke(IPC.TASK_EDIT, {
          id: task.id,
          updates: { status: newStatus, completedAt: undefined },
        });
      }
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6 overflow-y-auto">
      <div className="flex-1 flex flex-col min-h-0 max-w-2xl">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {task.title}
          </h1>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleStart}
              disabled={status === 'working'}
            >
              <Play className="h-4 w-4 mr-1" />
              开始专注
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleComplete}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {task.status === 'completed' ? '恢复' : '完成'}
            </Button>
          </div>
        </div>

        <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <span>🍅 已完成 {task.completedPomodoros} 个番茄</span>
          <span>📅 创建于 {new Date(task.createdAt).toLocaleDateString()}</span>
        </div>

        {isSaving && (
          <p data-testid="task-notes-saving" className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            保存中...
          </p>
        )}
        {saveError && (
          <p data-testid="task-notes-save-error" className="text-sm text-red-500 mb-2">
            {saveError}
          </p>
        )}

        <div className="flex-1 flex flex-col min-h-0 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex-1 min-h-0" data-color-mode="auto">
            <MDEditor
              value={notes}
              onChange={(val) => setNotes(val || '')}
              preview="live"
              height="100%"
              textareaProps={{
                placeholder: '添加笔记...',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
