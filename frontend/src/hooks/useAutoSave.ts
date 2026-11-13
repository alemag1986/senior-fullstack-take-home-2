import { useEffect, useRef, useState } from 'react';
import { JournalEntry } from '../types/journal';

export function useAutoSave(entry: JournalEntry, sessionGuid: string) {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const initialLoadedRef = useRef(false);
  const lastGuidRef = useRef(sessionGuid);

  const storageKey = `journal_draft_${sessionGuid}`;

  // Restore on initial mount or when user session changes
  const restoreDraft = (guid = sessionGuid): Partial<JournalEntry> | null => {
    try {
      const stored = localStorage.getItem(`journal_draft_${guid}`);
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
    // If user / sessionGuid changed, reset dirty state and skip saving old entry into new user draft
    if (lastGuidRef.current !== sessionGuid) {
      lastGuidRef.current = sessionGuid;
      initialLoadedRef.current = false;
      setIsDirty(false);
      return;
    }

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
  }, [entry.content, entry.title, entry.targetLanguage, entry.revision, storageKey, sessionGuid]);

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
