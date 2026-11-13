import React from 'react';
import { ActiveSuggestion, FeedbackCategory } from '../../types/journal';
import { getLineAndCol, isDeletion, isInsertion } from '../../utils/offsetUtils';

export interface SuggestionCardProps {
  suggestion: ActiveSuggestion;
  index: number;
  content: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  index,
  content,
  isSelected,
  onSelect,
  onAccept,
  onDismiss,
}) => {
  const { category, edit, explanation } = suggestion;
  const { line, col } = getLineAndCol(content, suggestion.activeRange.start);

  const getCategoryBadge = (cat: FeedbackCategory) => {
    switch (cat) {
      case 'grammar_syntax':
        return {
          label: 'Grammar',
          classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        };
      case 'vocabulary_phrasing':
        return {
          label: 'Vocabulary',
          classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        };
      case 'spelling_accents':
        return {
          label: 'Spelling',
          classes: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        };
    }
  };

  const badge = getCategoryBadge(category);

  const handleCardClick = () => {
    onSelect(suggestion.id);

    // Scroll and pulse target element in editor canvas
    const target =
      document.querySelector(`[data-testid="suggestion-mark-${suggestion.id}"]`) ||
      document.querySelector(`[data-testid="insertion-marker-${suggestion.id}"]`);

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('ring-4', 'ring-cyan-500', 'animate-pulse');
      setTimeout(() => {
        target.classList.remove('ring-4', 'ring-cyan-500', 'animate-pulse');
      }, 1600);
    }

    const textarea = document.querySelector(
      'textarea[data-testid="journal-textarea"]'
    ) as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.setSelectionRange(suggestion.activeRange.start, suggestion.activeRange.end);
    }
  };

  return (
    <div
      data-testid={`suggestion-card-${suggestion.id}`}
      onClick={handleCardClick}
      className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500 shadow-md ring-1 ring-blue-400 dark:ring-blue-500'
          : 'bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs'
      }`}
    >
      {/* Header: Reference #, Category, Location, Jump icon */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            #{index}
          </span>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge.classes}`}
          >
            {badge.label}
          </span>
          <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
            Ln {line}, Col {col}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCardClick();
          }}
          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 font-medium shrink-0"
          title="Jump to position in editor"
        >
          Jump ↗
        </button>
      </div>

      {/* Diff display */}
      <div className="font-mono text-xs p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 mb-2.5 flex items-center flex-wrap gap-1.5">
        {isDeletion(edit) ? (
          <>
            <span className="text-zinc-400 dark:text-zinc-500">Delete:</span>
            <span className="line-through text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1 py-0.5 rounded font-semibold">
              {edit.original}
            </span>
          </>
        ) : isInsertion(edit) ? (
          <>
            <span className="text-zinc-400 dark:text-zinc-500">Insert:</span>
            <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.5 rounded font-semibold">
              +{edit.replacement}
            </span>
          </>
        ) : (
          <>
            <span className="line-through text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1 py-0.5 rounded font-semibold">
              {edit.original}
            </span>
            <span className="text-zinc-400 dark:text-zinc-500 font-sans">➔</span>
            <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.5 rounded font-semibold">
              {edit.replacement}
            </span>
          </>
        )}
      </div>

      {/* Explanation */}
      <div className="text-xs mb-3 space-y-0.5">
        <h4 className="font-semibold text-zinc-800 dark:text-zinc-200">
          {explanation.title}
        </h4>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-[11.5px]">
          {explanation.message}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/70">
        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase">
          {suggestion.ruleCode}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid={`dismiss-btn-${suggestion.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(suggestion.id);
            }}
            className="px-2.5 py-1 text-xs font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Dismiss
          </button>
          <button
            type="button"
            data-testid={`accept-btn-${suggestion.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onAccept(suggestion.id);
            }}
            className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};
