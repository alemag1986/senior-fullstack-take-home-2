import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActiveSuggestion } from '../../types/journal';
import { isDeletion, isInsertion } from '../../utils/offsetUtils';

interface SuggestionPopoverProps {
  suggestion: ActiveSuggestion;
  anchorRect?: DOMRect | null;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
  currentIndex?: number;
  totalCount?: number;
}

export const SuggestionPopover: React.FC<SuggestionPopoverProps> = ({
  suggestion,
  anchorRect,
  onAccept,
  onDismiss,
  onClose,
  currentIndex,
  totalCount,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const acceptBtnRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Focus accept button on mount for quick keyboard acceptance
  useEffect(() => {
    acceptBtnRef.current?.focus();
  }, [suggestion.id]);

  // Calculate position safely within viewport
  const updatePosition = useCallback(() => {
    let rect = anchorRect;
    if (!rect && typeof document !== 'undefined') {
      const mark =
        document.querySelector(`[data-testid="suggestion-mark-${suggestion.id}"]`) ||
        document.querySelector(`[data-testid="insertion-marker-${suggestion.id}"]`);
      if (mark) {
        rect = mark.getBoundingClientRect();
      }
    }

    const popoverWidth = 340;
    const popoverEstimatedHeight = 220;

    if (rect && typeof window !== 'undefined') {
      // Position relative to viewport since it's fixed
      let top = rect.bottom + 8;
      // If overflowing bottom of viewport, flip above the anchor
      if (top + popoverEstimatedHeight > window.innerHeight - 16) {
        top = Math.max(16, rect.top - popoverEstimatedHeight - 8);
      }

      let left = rect.left;
      left = Math.max(16, Math.min(left, window.innerWidth - popoverWidth - 16));

      setPosition({ top: Math.round(top), left: Math.round(left) });
    } else if (typeof window !== 'undefined') {
      // Fallback: bottom right
      setPosition({
        top: Math.max(16, window.innerHeight - popoverEstimatedHeight - 32),
        left: Math.max(16, window.innerWidth - popoverWidth - 24),
      });
    }
  }, [anchorRect, suggestion.id]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  // Keyboard navigation inside popover:
  // Enter accepts if card has focus, Escape closes
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  const { category, kind, edit, explanation } = suggestion;

  // Category labels and colors
  const categoryConfig = {
    grammar_syntax: {
      label: 'Grammar & Syntax',
      badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300',
    },
    vocabulary_phrasing: {
      label: 'Vocabulary & Phrasing',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
    },
    spelling_accents: {
      label: 'Spelling & Accents',
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300',
    },
  }[category];

  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 50,
    ...(position
      ? { top: `${position.top}px`, left: `${position.left}px` }
      : { bottom: '80px', right: '24px' }),
  };

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Correction Suggestion"
      data-testid="suggestion-popover"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={style}
      className="z-50 w-80 max-w-[calc(100vw-32px)] p-4 rounded-xl shadow-2xl border transition-all animate-in fade-in zoom-in-95
        bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800 font-sans"
    >
      {/* Header: Category + Optional Improvement Chip + Counter + Close Button */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryConfig.badgeClass}`}>
            {categoryConfig.label}
          </span>
          {kind === 'improvement' && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
              Optional improvement
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentIndex !== undefined && totalCount !== undefined && totalCount > 1 && (
            <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
              {currentIndex + 1} of {totalCount}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded transition-colors text-xs leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Explanation Title */}
      <h4 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-1">
        {explanation.title}
      </h4>

      {/* Diff Pill */}
      <div className="my-2.5 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 font-mono text-xs flex items-center gap-2 flex-wrap">
        {!isInsertion(edit) && (
          <span className="line-through text-rose-500 dark:text-rose-400">
            {edit.original}
          </span>
        )}
        {!isInsertion(edit) && !isDeletion(edit) && (
          <span className="text-zinc-400">→</span>
        )}
        {edit.replacement && (
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {edit.replacement}
          </span>
        )}
        {isDeletion(edit) && (
          <span className="text-xs text-zinc-400 italic">(delete word)</span>
        )}
      </div>

      {/* Explanation Message */}
      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 mb-4">
        {explanation.message}
      </p>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => onDismiss(suggestion.id)}
          className="px-2.5 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded transition-colors"
        >
          Dismiss
        </button>
        <button
          ref={acceptBtnRef}
          type="button"
          onClick={() => onAccept(suggestion.id)}
          className="px-3 py-1 text-xs font-medium rounded-md shadow-sm bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-white transition-colors"
        >
          Accept <kbd className="ml-1 text-[10px] opacity-70">Enter</kbd>
        </button>
      </div>
    </div>
  );
};
