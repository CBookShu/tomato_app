export function normalizeTaskNotes(notes?: string | null): string {
  return notes ?? '';
}

export function shouldAutoSaveNotes(
  isNotesLoaded: boolean,
  lastSavedNotes: string | null,
  debouncedNotes: string,
): boolean {
  return isNotesLoaded && lastSavedNotes !== null && debouncedNotes !== lastSavedNotes;
}
