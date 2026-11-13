import React, { useEffect, useMemo, useState } from 'react';
import { ActiveSuggestion, FeedbackCategory } from '../../types/journal';
import { SuggestionCard } from './SuggestionCard';

export interface SideReviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeSuggestions: ActiveSuggestion[];
  selectedSuggestionId: string | null;
  content: string;
  isStale: boolean;
  onSelectSuggestion: (id: string) => void;
  onAcceptSuggestion: (id: string) => void;
  onDismissSuggestion: (id: string) => void;
  onAcceptAll: () => void;
  onDismissAll: () => void;
  onReviewAgain: () => void;
  mistakesHistory?: ActiveSuggestion[];
}

type FilterCategory = 'all' | FeedbackCategory;
type FilterStatus = 'all' | 'pending' | 'accepted' | 'dismissed';

export const SideReviewPanel: React.FC<SideReviewPanelProps> = ({
  isOpen,
  onClose,
  activeSuggestions,
  selectedSuggestionId,
  content,
  isStale,
  onSelectSuggestion,
  onAcceptSuggestion,
  onDismissSuggestion,
  onAcceptAll,
  onDismissAll,
  onReviewAgain,
  mistakesHistory,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('all');
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');

  // Combine active suggestions with mistakes history if needed
  const allSuggestions = useMemo(() => {
    if (activeSuggestions && activeSuggestions.length > 0) {
      return activeSuggestions;
    }
    if (mistakesHistory && mistakesHistory.length > 0) {
      return mistakesHistory;
    }
    return [];
  }, [activeSuggestions, mistakesHistory]);

  // Breakdown by suggestion state
  const pendingSuggestions = useMemo(
    () => allSuggestions.filter((s) => s.state === 'pending'),
    [allSuggestions]
  );
  const acceptedSuggestions = useMemo(
    () => allSuggestions.filter((s) => s.state === 'accepted'),
    [allSuggestions]
  );
  const dismissedSuggestions = useMemo(
    () => allSuggestions.filter((s) => s.state === 'dismissed'),
    [allSuggestions]
  );

  // Status-filtered suggestions
  const statusFiltered = useMemo(() => {
    switch (selectedStatus) {
      case 'pending':
        return pendingSuggestions;
      case 'accepted':
        return acceptedSuggestions;
      case 'dismissed':
        return dismissedSuggestions;
      case 'all':
      default:
        return allSuggestions;
    }
  }, [allSuggestions, pendingSuggestions, acceptedSuggestions, dismissedSuggestions, selectedStatus]);

  // Category counts
  const counts = useMemo(() => {
    const base = selectedStatus === 'all' ? allSuggestions : statusFiltered;
    const res = {
      all: base.length,
      grammar_syntax: 0,
      vocabulary_phrasing: 0,
      spelling_accents: 0,
    };
    base.forEach((s) => {
      res[s.category] = (res[s.category] || 0) + 1;
    });
    return res;
  }, [allSuggestions, statusFiltered, selectedStatus]);

  // Filtered list by both status and category
  const filteredSuggestions = useMemo(() => {
    if (selectedCategory === 'all') return statusFiltered;
    return statusFiltered.filter((s) => s.category === selectedCategory);
  }, [statusFiltered, selectedCategory]);

  // Auto-scroll the active card into view in the side panel
  useEffect(() => {
    if (selectedSuggestionId && isOpen) {
      const card = document.querySelector(
        `[data-testid="suggestion-card-${selectedSuggestionId}"]`
      );
      card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedSuggestionId, isOpen]);

  if (!isOpen) return null;

  return (
    <aside
      data-testid="side-review-panel"
      className="fixed top-0 right-0 h-full w-full sm:w-96 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col transition-transform duration-300 animate-in slide-in-from-right"
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-950/40">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              AI Corrections
            </h3>
            <span
              data-testid="pending-count-badge"
              className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
              title={`${pendingSuggestions.length} pending correction${pendingSuggestions.length !== 1 ? 's' : ''}`}
            >
              {pendingSuggestions.length}
            </span>
            {acceptedSuggestions.length > 0 && (
              <span
                data-testid="accepted-count-badge"
                className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                title={`${acceptedSuggestions.length} accepted mistake${acceptedSuggestions.length !== 1 ? 's' : ''}`}
              >
                {acceptedSuggestions.length} accepted
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            History of changes & AI review explanations
          </p>
        </div>

        <button
          type="button"
          data-testid="close-review-panel-btn"
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Close panel (Ctrl+J / Esc)"
          aria-label="Close review panel"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stale Warning Banner */}
      {isStale && (
        <div
          data-testid="panel-stale-banner"
          className="px-4 py-2 bg-amber-50 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between shrink-0"
        >
          <span>Draft changed since review.</span>
          <button
            type="button"
            onClick={onReviewAgain}
            className="underline font-semibold hover:text-amber-950 dark:hover:text-amber-100 ml-2"
          >
            Review again
          </button>
        </div>
      )}

      {/* Status Filter Tabs (Review & Mistake History) */}
      <div className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-medium bg-zinc-50/70 dark:bg-zinc-950/50 shrink-0">
        <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          State:
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="filter-status-all"
            onClick={() => setSelectedStatus('all')}
            className={`px-2 py-0.5 rounded-md transition-colors ${
              selectedStatus === 'all'
                ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
            }`}
          >
            All ({allSuggestions.length})
          </button>
          <button
            type="button"
            data-testid="filter-status-pending"
            onClick={() => setSelectedStatus('pending')}
            className={`px-2 py-0.5 rounded-md transition-colors ${
              selectedStatus === 'pending'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
            }`}
          >
            Pending ({pendingSuggestions.length})
          </button>
          <button
            type="button"
            data-testid="filter-status-accepted"
            onClick={() => setSelectedStatus('accepted')}
            className={`px-2 py-0.5 rounded-md transition-colors ${
              selectedStatus === 'accepted'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
            }`}
          >
            Accepted ({acceptedSuggestions.length})
          </button>
          {dismissedSuggestions.length > 0 && (
            <button
              type="button"
              data-testid="filter-status-dismissed"
              onClick={() => setSelectedStatus('dismissed')}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                selectedStatus === 'dismissed'
                  ? 'bg-zinc-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              Dismissed ({dismissedSuggestions.length})
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="p-2 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center gap-1 overflow-x-auto shrink-0 bg-white dark:bg-zinc-900 text-xs font-medium">
        <button
          type="button"
          data-testid="filter-tab-all"
          onClick={() => setSelectedCategory('all')}
          className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
            selectedCategory === 'all'
              ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          All ({counts.all})
        </button>
        <button
          type="button"
          data-testid="filter-tab-grammar"
          onClick={() => setSelectedCategory('grammar_syntax')}
          className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
            selectedCategory === 'grammar_syntax'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-purple-50 dark:hover:bg-purple-950/40'
          }`}
        >
          Grammar ({counts.grammar_syntax})
        </button>
        <button
          type="button"
          data-testid="filter-tab-vocab"
          onClick={() => setSelectedCategory('vocabulary_phrasing')}
          className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
            selectedCategory === 'vocabulary_phrasing'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
          }`}
        >
          Vocab ({counts.vocabulary_phrasing})
        </button>
        <button
          type="button"
          data-testid="filter-tab-spelling"
          onClick={() => setSelectedCategory('spelling_accents')}
          className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
            selectedCategory === 'spelling_accents'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
          }`}
        >
          Spelling ({counts.spelling_accents})
        </button>
      </div>

      {/* Batch Actions Bar (when pending suggestions exist) */}
      {pendingSuggestions.length > 0 && !isStale && (
        <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs shrink-0 bg-zinc-50/50 dark:bg-zinc-950/30">
          <span className="text-zinc-500 dark:text-zinc-400">Batch:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="dismiss-all-btn"
              onClick={onDismissAll}
              className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline font-medium"
            >
              Dismiss All
            </button>
            <button
              type="button"
              data-testid="accept-all-btn"
              onClick={onAcceptAll}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium shadow-xs transition-colors"
            >
              Accept All ({pendingSuggestions.length})
            </button>
          </div>
        </div>
      )}

      {/* Cards Scroll Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* All Accepted Banner when all corrections applied */}
        {pendingSuggestions.length === 0 && acceptedSuggestions.length > 0 && selectedStatus !== 'pending' && (
          <div
            data-testid="all-accepted-banner"
            className="p-3 mb-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5"
          >
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">✓</span>
            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                All corrections applied!
              </p>
              <p className="text-[11px] opacity-90 mt-0.5">
                Review your accepted mistakes below to reinforce grammar and vocabulary.
              </p>
            </div>
          </div>
        )}

        {filteredSuggestions.length === 0 ? (
          <div
            data-testid="panel-empty-state"
            className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400 dark:text-zinc-500"
          >
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl mb-3">
              ✓
            </div>
            <p className="font-medium text-sm text-zinc-700 dark:text-zinc-300">
              {allSuggestions.length === 0
                ? 'No suggestions found'
                : selectedStatus === 'pending' && acceptedSuggestions.length > 0
                ? 'All pending suggestions applied'
                : 'No suggestions in this category'}
            </p>
            <p className="text-xs mt-1 text-zinc-500 dark:text-zinc-400 max-w-xs">
              {allSuggestions.length === 0
                ? 'Your text looks great or all suggestions have been addressed.'
                : selectedStatus === 'pending' && acceptedSuggestions.length > 0
                ? 'Click the "Accepted" or "All" tab above to review your mistake history.'
                : 'Switch tabs or run review again to see other suggestions.'}
            </p>
          </div>
        ) : (
          filteredSuggestions.map((suggestion, idx) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              index={idx + 1}
              content={content}
              isSelected={suggestion.id === selectedSuggestionId}
              onSelect={onSelectSuggestion}
              onAccept={onAcceptSuggestion}
              onDismiss={onDismissSuggestion}
            />
          ))
        )}
      </div>

      {/* Footer shortcut tip */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-400 dark:text-zinc-500 flex items-center justify-between shrink-0 bg-zinc-50/70 dark:bg-zinc-950/60">
        <span>Toggle: Ctrl+J</span>
        <span>Review: Ctrl+Enter</span>
      </div>
    </aside>
  );
};
