import { useEffect, useRef, useState } from 'react';
import { JournalEntry } from '../types/journal';

export function useAutoSave(entry: JournalEntry, sessionGuid: string) {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const initialLoadedRef = useRef(false);

  const storageKey = `journal_draft_${sessionGuid}`;

  // Restore on initial mount
  const restoreDraft = (): Partial<JournalEntry> | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  };

  // Auto-save debounced
  useEffect(() => {
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      return;
    }

    setIsDirty(true);
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(entry));
        setLastSavedAt(new Date());
        setIsDirty(false);
      } catch {
        // Storage quota or error
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [entry.content, entry.title, entry.targetLanguage, entry.revision, storageKey]);

  const clearDraft = () => {
    localStorage.removeItem(storageKey);
    setIsDirty(false);
  };

  return {
    isDirty,
    lastSavedAt,
    restoreDraft,
    clearDraft,
  };
}
