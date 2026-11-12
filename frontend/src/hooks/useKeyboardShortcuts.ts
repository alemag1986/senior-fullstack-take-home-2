import { useEffect } from 'react';

export interface ShortcutHandlers {
  onSave?: () => void;
  onReview?: () => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
  onEscape?: () => void;
  onToggleCompare?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();

      // Escape key (modal close / focus return)
      if (e.key === 'Escape') {
        if (handlers.onEscape) {
          e.preventDefault();
          handlers.onEscape();
          return;
        }
      }

      // Help: Ctrl+/ or Cmd+/ or bare '?' when not typing in an input
      if ((modifier && e.key === '/') || (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName))) {
        if (handlers.onOpenHelp) {
          e.preventDefault();
          handlers.onOpenHelp();
          return;
        }
      }

      // Save: Ctrl+S or Cmd+S
      if (modifier && key === 's') {
        e.preventDefault();
        handlers.onSave?.();
        return;
      }

      // AI Review: Ctrl+Enter or Cmd+Enter or Alt+R
      if ((modifier && e.key === 'Enter') || (e.altKey && key === 'r')) {
        e.preventDefault();
        handlers.onReview?.();
        return;
      }

      // History: Ctrl+H (Windows/Linux) or Cmd+O (Mac) or Alt+H
      if ((e.ctrlKey && key === 'h') || (isMac && e.metaKey && key === 'o') || (e.altKey && key === 'h')) {
        e.preventDefault();
        handlers.onOpenHistory?.();
        return;
      }

      // Screen Options / Settings: Ctrl+, or Cmd+, or Alt+T
      if ((modifier && e.key === ',') || (e.altKey && key === 't')) {
        e.preventDefault();
        handlers.onOpenSettings?.();
        return;
      }

      // Quick Compare view: Alt+C or Ctrl+Shift+C
      if ((e.altKey && key === 'c') || (modifier && e.shiftKey && key === 'c')) {
        e.preventDefault();
        handlers.onToggleCompare?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, enabled]);
}
