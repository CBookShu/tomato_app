export function normalizeTaskNotes(notes?: string | null): string {
  return notes ?? '';
}

export function shouldAutoSaveNotes(
  taskId: string | null | undefined,
  lastSavedNotes: string | null,
  debouncedNotes: string,
): boolean {
  return Boolean(taskId) && lastSavedNotes !== null && debouncedNotes !== lastSavedNotes;
}
