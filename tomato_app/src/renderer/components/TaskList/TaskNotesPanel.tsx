import { memo, useCallback, useEffect, useRef, useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { useIpc } from '@/hooks/useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import { useDebounce } from '@/hooks/useDebounce.js';
import { normalizeTaskNotes, shouldAutoSaveNotes } from '@/lib/task-notes.js';

const AUTO_SAVE_DELAY_MS = 500;

interface TaskNotesPanelProps {
  taskId: string;
}

function TaskNotesPanel({ taskId }: TaskNotesPanelProps) {
  const { invoke } = useIpc();
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedNotes, setLastSavedNotes] = useState<string | null>(null);
  const [isNotesLoaded, setIsNotesLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const notesSessionRef = useRef(0);
  const saveRequestRef = useRef(0);
  const debouncedNotes = useDebounce(notes, AUTO_SAVE_DELAY_MS);

  useEffect(() => {
    let cancelled = false;
    ++notesSessionRef.current;
    saveRequestRef.current = 0;
    setNotes('');
    setLastSavedNotes(null);
    setIsNotesLoaded(false);
    setIsSaving(false);
    setSaveError(null);

    void (async () => {
      try {
        const currentNotes = normalizeTaskNotes(
          await invoke(IPC.NOTES_GET, { taskId }),
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
  }, [taskId, invoke]);

  useEffect(() => {
    setSaveError(null);
  }, [taskId]);

  const handleSaveNotes = useCallback(async (value: string) => {
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
  }, [invoke, taskId]);

  useEffect(() => {
    if (!shouldAutoSaveNotes(isNotesLoaded, lastSavedNotes, debouncedNotes)) {
      return;
    }
    void handleSaveNotes(debouncedNotes);
  }, [debouncedNotes, handleSaveNotes, isNotesLoaded, lastSavedNotes]);

  return (
    <div data-testid="task-notes-panel" className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 min-h-[1.5rem]">
        {isSaving && (
          <p data-testid="task-notes-saving" className="text-sm text-gray-500 dark:text-gray-400">
            保存中...
          </p>
        )}
        {saveError && (
          <p data-testid="task-notes-save-error" className="text-sm text-red-500">
            {saveError}
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 border-t border-gray-200 pt-4 dark:border-gray-700" data-color-mode="auto">
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
  );
}

export const MemoTaskNotesPanel = memo(TaskNotesPanel);
