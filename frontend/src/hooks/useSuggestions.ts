import { useState } from 'react';
import { ActiveSuggestion, Analysis, JournalEntry } from '../types/journal';
import { applyAllPendingSuggestions, applySuggestion } from '../utils/offsetUtils';

export function useSuggestions(
  entry: JournalEntry,
  onUpdateContent: (newContent: string, newRevision: number) => void
) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [activeSuggestions, setActiveSuggestions] = useState<ActiveSuggestion[]>([]);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);

  /**
   * Applies an incoming analysis response with race-condition guard:
   * Only accept if entryRevision and sourceText match the entry at the time of response.
   */
  const applyAnalysis = (incoming: Analysis, currentEntry: JournalEntry): boolean => {
    setIsLoading(false);

    if (incoming.status === 'failed') {
      setError(incoming.error || 'Feedback analysis failed.');
      setAnalysis(incoming);
      return false;
    }

    // Race condition guard
    if (
      incoming.entryRevision !== currentEntry.revision ||
      incoming.sourceText !== currentEntry.content
    ) {
      // Outdated response, discard
      return false;
    }

    setAnalysis(incoming);
    setError(null);
    setIsStale(false);

    // Initialize active suggestions mapping from immutable analysis
    const initialActive: ActiveSuggestion[] = incoming.suggestions.map((s) => ({
      ...s,
      state: 'pending',
      activeRange: {
        start: s.edit.start,
        end: s.edit.end,
      },
    }));

    setActiveSuggestions(initialActive);
    setSelectedSuggestionId(initialActive[0]?.id || null);
    return true;
  };

  /**
   * Handles user accepting a suggestion.
   */
  const acceptSuggestion = (id: string) => {
    if (isStale) return;

    const result = applySuggestion(entry.content, activeSuggestions, id);
    if (!result.success) {
      setError(result.error || 'Could not apply suggestion.');
      return;
    }

    setActiveSuggestions(result.updatedSuggestions);
    const nextPending = result.updatedSuggestions.find(
      (s) => s.state === 'pending' && s.id !== id
    );
    setSelectedSuggestionId(nextPending ? nextPending.id : null);
    // Increment local entry revision and update text
    onUpdateContent(result.newText, entry.revision + 1);
  };

  /**
   * Handles user dismissing a suggestion.
   * Underline is removed, but text remains untouched.
   */
  const dismissSuggestion = (id: string) => {
    const updated = activeSuggestions.map((s) =>
      s.id === id ? { ...s, state: 'dismissed' as const } : s
    );
    setActiveSuggestions(updated);
    if (selectedSuggestionId === id) {
      const nextPending = updated.find(
        (s) => s.state === 'pending' && s.id !== id
      );
      setSelectedSuggestionId(nextPending ? nextPending.id : null);
    }
  };

  /**
   * Accepts all pending suggestions in batch.
   */
  const acceptAllSuggestions = () => {
    if (isStale) return;
    const result = applyAllPendingSuggestions(entry.content, activeSuggestions);
    if (!result.success || result.appliedCount === 0) return;

    setActiveSuggestions(result.updatedSuggestions);
    setSelectedSuggestionId(null);
    onUpdateContent(result.newText, entry.revision + 1);
  };

  /**
   * Dismisses all pending suggestions.
   */
  const dismissAllSuggestions = () => {
    const updated = activeSuggestions.map((s) =>
      s.state === 'pending' ? { ...s, state: 'dismissed' as const } : s
    );
    setActiveSuggestions(updated);
    setSelectedSuggestionId(null);
  };

  /**
   * Handles manual edits to the editor canvas:
   * Marks the current analysis as stale, clears active underlines, and shows notice.
   */
  const notifyManualEdit = () => {
    if (activeSuggestions.length > 0 && !isStale) {
      setIsStale(true);
      // Clear active underlines visually
      setActiveSuggestions([]);
      setSelectedSuggestionId(null);
    }
  };

  const clearAnalysis = () => {
    setAnalysis(null);
    setActiveSuggestions([]);
    setIsStale(false);
    setError(null);
    setSelectedSuggestionId(null);
  };

  return {
    analysis,
    activeSuggestions,
    isStale,
    isLoading,
    error,
    selectedSuggestionId,
    setIsLoading,
    setError,
    setSelectedSuggestionId,
    applyAnalysis,
    acceptSuggestion,
    dismissSuggestion,
    acceptAllSuggestions,
    dismissAllSuggestions,
    notifyManualEdit,
    clearAnalysis,
  };
}
