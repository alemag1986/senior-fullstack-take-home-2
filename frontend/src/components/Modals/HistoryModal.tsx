import React, { useEffect, useState } from 'react';
import { JournalEntry } from '../../types/journal';
import { ModalBackdrop } from '../Common/ModalBackdrop';

interface HistoryModalProps {
  entries: JournalEntry[];
  currentEntryId: string;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onRefresh?: () => void;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  entries,
  currentEntryId,
  onSelectEntry,
  onNewEntry,
  onRefresh,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Sort entries from newer to older (reverse chronological)
  const sortedEntries = [...entries].sort((a, b) => {
    const timeA = a.updatedAt || a.createdAt || '';
    const timeB = b.updatedAt || b.createdAt || '';
    return timeB.localeCompare(timeA);
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, sortedEntries.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (sortedEntries[selectedIndex]) {
          onSelectEntry(sortedEntries[selectedIndex]);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, sortedEntries, onSelectEntry, onClose]);

  return (
    <ModalBackdrop onClose={onClose} title="Journal Entries History">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
            Journal Entries
          </h3>
          <p className="text-xs text-zinc-400">Sorted newer to older</p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              data-testid="refresh-history-button"
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
              title="Refresh journals from server and sync storage"
            >
              ↻ Refresh
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onNewEntry();
              onClose();
            }}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90"
          >
            + New Entry
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            Esc
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto p-3 divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono text-xs">
        {sortedEntries.length === 0 ? (
          <div className="py-12 text-center text-zinc-400">
            No saved entries yet. Type your journal entry and press <kbd>Ctrl+S</kbd>.
          </div>
        ) : (
          sortedEntries.map((entry, idx) => {
            const isSelected = idx === selectedIndex;
            const isCurrent = entry.id === currentEntryId;
            const preview = entry.content.trim().slice(0, 80) || '(Empty entry)';

            return (
              <div
                key={entry.id}
                onClick={() => {
                  onSelectEntry(entry);
                  onClose();
                }}
                className={`p-3 rounded-xl cursor-pointer transition-colors flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="uppercase px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 font-semibold text-zinc-600 dark:text-zinc-300">
                      {entry.targetLanguage}
                    </span>
                    {isCurrent && (
                      <span className="text-emerald-500 font-medium">● Current</span>
                    )}
                  </div>
                  <span>
                    {entry.updatedAt
                      ? new Date(entry.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Draft'}
                  </span>
                </div>
                <div className="text-xs truncate text-zinc-800 dark:text-zinc-200 font-normal">
                  {preview}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-6 py-3 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
        <span>Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate, <kbd>Enter</kbd> to open</span>
        <span>{sortedEntries.length} entries</span>
      </div>
    </ModalBackdrop>
  );
};
