import React from 'react';
import { ModalBackdrop } from '../Common/ModalBackdrop';

interface HelpModalProps {
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    { key: `${mod} + S`, description: 'Save current journal entry' },
    { key: `${mod} + Enter`, description: 'Send entry for AI Review & Suggestions (or Alt+R)' },
    { key: isMac ? '⌘ + O / Ctrl + H' : 'Ctrl + H', description: 'Open entries history (newer to older)' },
    { key: `${mod} + ,`, description: 'Screen & Session options (theme, language, GUID)' },
    { key: 'Alt + C', description: 'Toggle version comparison (word-level diff)' },
    { key: 'Enter', description: 'Accept suggestion (when suggestion popover has focus)' },
    { key: 'Esc', description: 'Close any modal / popover and return cursor to editor' },
    { key: `${mod} + /`, description: 'Show keyboard shortcuts' },
  ];

  return (
    <ModalBackdrop onClose={onClose} title="Keyboard Commands">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
            Keyboard Commands
          </h3>
          <p className="text-xs text-zinc-400">Native, distraction-free hotkeys</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          Esc
        </button>
      </div>

      <div className="p-6 divide-y divide-zinc-100 dark:divide-zinc-800 font-mono text-xs">
        {shortcuts.map((s, idx) => (
          <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
            <span className="text-zinc-600 dark:text-zinc-400 font-sans text-xs">
              {s.description}
            </span>
            <kbd className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold shadow-xs whitespace-nowrap">
              {s.key}
            </kbd>
          </div>
        ))}
      </div>

      <div className="px-6 py-3 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400 text-center">
        Tip: The app operates entirely by keyboard so you never leave your writing flow.
      </div>
    </ModalBackdrop>
  );
};
