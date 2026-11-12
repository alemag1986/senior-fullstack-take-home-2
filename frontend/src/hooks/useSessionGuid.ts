import { useState } from 'react';

const STORAGE_KEY = 'journal_session_guid';

function generateGuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useSessionGuid() {
  const [sessionGuid, setSessionGuid] = useState<string>(() => {
    if (typeof window === 'undefined') return generateGuid();
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.trim()) {
      return existing.trim();
    }
    const fresh = generateGuid();
    localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  });

  const updateSessionGuid = (newGuid: string): boolean => {
    const trimmed = newGuid.trim();
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmed)) {
      return false;
    }
    localStorage.setItem(STORAGE_KEY, trimmed);
    setSessionGuid(trimmed);
    return true;
  };

  const regenerateGuid = () => {
    const fresh = generateGuid();
    localStorage.setItem(STORAGE_KEY, fresh);
    setSessionGuid(fresh);
  };

  return {
    sessionGuid,
    updateSessionGuid,
    regenerateGuid,
  };
}
