import React, { useEffect, useState } from 'react';
import { JournalEntry } from '../../types/journal';
import { ModalBackdrop } from '../Common/ModalBackdrop';

interface HistoryModalProps {
  entries: JournalEntry[];
  currentEntryId: string;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onRefresh?: () => void;
  onDeleteEntry?: (entryId: string) => Promise<void> | void;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  entries,
  currentEntryId,
  onSelectEntry,
  onNewEntry,
  onRefresh,
  onDeleteEntry,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
                className={`group p-3 rounded-xl cursor-pointer transition-colors flex flex-col gap-1.5 ${
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
                  <div className="flex items-center gap-2">
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
                    {confirmDeleteId === entry.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          data-testid={`confirm-delete-${entry.id}`}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (onDeleteEntry) {
                              await onDeleteEntry(entry.id);
                            }
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-0.5 text-[10px] font-semibold rounded bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          data-testid={`cancel-delete-${entry.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="px-1.5 py-0.5 text-[10px] rounded border border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      onDeleteEntry && (
                        <button
                          type="button"
                          data-testid={`delete-entry-${entry.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(entry.id);
                          }}
                          className="opacity-60 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 p-1 rounded text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                          title="Remove entry"
                          aria-label={`Remove entry ${entry.title || entry.id}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )
                    )}
                  </div>
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
