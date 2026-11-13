import React from 'react';
import { ActiveSuggestion, FeedbackCategory } from '../../types/journal';
import { isInsertion } from '../../utils/offsetUtils';

interface InlineDecorationsProps {
  text: string;
  activeSuggestions: ActiveSuggestion[];
  selectedSuggestionId: string | null;
  onSelectSuggestion: (id: string, rect?: DOMRect) => void;
}

export const InlineDecorations: React.FC<InlineDecorationsProps> = ({
  text,
  activeSuggestions,
  selectedSuggestionId,
  onSelectSuggestion,
}) => {
  // Only render pending suggestions
  const pending = activeSuggestions.filter((s) => s.state === 'pending');

  if (pending.length === 0) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }

  // Create slices for the entire text length
  // We sort suggestions by start offset
  const sorted = [...pending].sort((a, b) => a.activeRange.start - b.activeRange.start);

  const elements: React.ReactNode[] = [];
  let currentIndex = 0;

  const getCategoryClass = (category: FeedbackCategory, isSelected: boolean) => {
    switch (category) {
      case 'grammar_syntax':
        return isSelected
          ? 'bg-purple-200/90 dark:bg-purple-900/70 text-purple-950 dark:text-purple-100 ring-2 ring-purple-500/80 dark:ring-purple-400 underline decoration-purple-600 dark:decoration-purple-400 decoration-wavy decoration-2 underline-offset-4 shadow-sm'
          : 'bg-purple-100/70 dark:bg-purple-950/60 text-purple-950 dark:text-purple-200 underline decoration-purple-500 decoration-wavy decoration-2 underline-offset-4 hover:bg-purple-200/80 dark:hover:bg-purple-900/60';
      case 'vocabulary_phrasing':
        return isSelected
          ? 'bg-amber-200/90 dark:bg-amber-900/70 text-amber-950 dark:text-amber-100 ring-2 ring-amber-500/80 dark:ring-amber-400 underline decoration-amber-600 dark:decoration-amber-400 decoration-wavy decoration-2 underline-offset-4 shadow-sm'
          : 'bg-amber-100/70 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 underline decoration-amber-500 decoration-wavy decoration-2 underline-offset-4 hover:bg-amber-200/80 dark:hover:bg-amber-900/60';
      case 'spelling_accents':
        return isSelected
          ? 'bg-rose-200/90 dark:bg-rose-900/70 text-rose-950 dark:text-rose-100 ring-2 ring-rose-500/80 dark:ring-rose-400 underline decoration-rose-600 dark:decoration-rose-400 decoration-wavy decoration-2 underline-offset-4 shadow-sm'
          : 'bg-rose-100/70 dark:bg-rose-950/60 text-rose-950 dark:text-rose-200 underline decoration-rose-500 decoration-wavy decoration-2 underline-offset-4 hover:bg-rose-200/80 dark:hover:bg-rose-900/60';
    }
  };

  sorted.forEach((suggestion) => {
    const { start, end } = suggestion.activeRange;

    // Normal text preceding suggestion
    if (start > currentIndex) {
      elements.push(
        <span key={`text-${currentIndex}`}>
          {text.slice(currentIndex, start)}
        </span>
      );
    }

    const isSelected = suggestion.id === selectedSuggestionId;
    const catClass = getCategoryClass(suggestion.category, isSelected);

    if (isInsertion(suggestion.edit)) {
      // Insertion marker when start === end
      elements.push(
        <button
          type="button"
          key={suggestion.id}
          data-testid={`insertion-marker-${suggestion.id}`}
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onSelectSuggestion(suggestion.id, rect);
          }}
          className={`inline-flex items-center justify-center align-middle mx-1 px-1.5 h-5 text-xs font-mono font-bold rounded cursor-pointer border transition-all ${
            suggestion.category === 'grammar_syntax'
              ? 'border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-300'
              : suggestion.category === 'vocabulary_phrasing'
              ? 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300'
              : 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300'
          } ${isSelected ? 'ring-2 ring-offset-1 ring-zinc-800 dark:ring-zinc-200' : ''}`}
          title="Click to view inserted word"
        >
          +
        </button>
      );
    } else {
      // Replacement or deletion underline
      const sliceText = text.slice(start, end);
      elements.push(
        <mark
          key={suggestion.id}
          data-testid={`suggestion-mark-${suggestion.id}`}
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onSelectSuggestion(suggestion.id, rect);
          }}
          className={`cursor-pointer rounded px-0.5 py-0.5 transition-colors [box-decoration-break:clone] ${catClass}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onSelectSuggestion(suggestion.id, rect);
            }
          }}
        >
          {sliceText}
        </mark>
      );
    }

    currentIndex = Math.max(currentIndex, end);
  });

  // Remaining trailing text
  if (currentIndex < text.length) {
    elements.push(
      <span key={`text-${currentIndex}`}>
        {text.slice(currentIndex)}
      </span>
    );
  }

  return <>{elements}</>;
};
