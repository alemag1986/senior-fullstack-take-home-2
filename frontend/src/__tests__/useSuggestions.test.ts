import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSuggestions } from '../hooks/useSuggestions';
import { Analysis, JournalEntry } from '../types/journal';

describe('useSuggestions hook', () => {
  const initialEntry: JournalEntry = {
    id: 'entry-1',
    title: 'Test',
    targetLanguage: 'es',
    content: 'Hoy fui a la biblioteka para estudiar.',
    revision: 1,
  };

  const sampleAnalysis: Analysis = {
    id: 'analysis-1',
    entryId: 'entry-1',
    entryRevision: 1,
    sourceText: 'Hoy fui a la biblioteka para estudiar.',
    status: 'completed',
    offsetEncoding: 'utf-16',
    suggestions: [
      {
        id: 'sug-1',
        category: 'spelling_accents',
        kind: 'correction',
        ruleCode: 'SPELL_K',
        edit: {
          start: 13,
          end: 23,
          original: 'biblioteka',
          replacement: 'biblioteca',
        },
        explanation: { title: 'Spelling', message: 'Use c instead of k' },
      },
    ],
  };

  it('applies valid analysis and populates active suggestions', () => {
    const onUpdateContent = vi.fn();
    const { result } = renderHook(() => useSuggestions(initialEntry, onUpdateContent));

    act(() => {
      const accepted = result.current.applyAnalysis(sampleAnalysis, initialEntry);
      expect(accepted).toBe(true);
    });

    expect(result.current.activeSuggestions.length).toBe(1);
    expect(result.current.activeSuggestions[0].state).toBe('pending');
    expect(result.current.isStale).toBe(false);
  });

  it('discards delayed responses that do not match current revision or text', () => {
    const onUpdateContent = vi.fn();
    const { result } = renderHook(() => useSuggestions(initialEntry, onUpdateContent));

    const outdatedAnalysis: Analysis = {
      ...sampleAnalysis,
      entryRevision: 0, // Outdated revision
    };

    act(() => {
      const accepted = result.current.applyAnalysis(outdatedAnalysis, initialEntry);
      expect(accepted).toBe(false);
    });

    expect(result.current.activeSuggestions.length).toBe(0);
  });

  it('accepts suggestion, calls onUpdateContent, and shifts subsequent ranges', () => {
    const onUpdateContent = vi.fn();
    const { result } = renderHook(() => useSuggestions(initialEntry, onUpdateContent));

    act(() => {
      result.current.applyAnalysis(sampleAnalysis, initialEntry);
    });

    act(() => {
      result.current.acceptSuggestion('sug-1');
    });

    expect(onUpdateContent).toHaveBeenCalledWith(
      'Hoy fui a la biblioteca para estudiar.',
      2 // incremented revision
    );
  });

  it('dismisses suggestion without updating text', () => {
    const onUpdateContent = vi.fn();
    const { result } = renderHook(() => useSuggestions(initialEntry, onUpdateContent));

    act(() => {
      result.current.applyAnalysis(sampleAnalysis, initialEntry);
    });

    act(() => {
      result.current.dismissSuggestion('sug-1');
    });

    expect(onUpdateContent).not.toHaveBeenCalled();
    const sug = result.current.activeSuggestions.find((s) => s.id === 'sug-1');
    expect(sug?.state).toBe('dismissed');
  });

  it('marks analysis stale on manual edit and clears active underlines', () => {
    const onUpdateContent = vi.fn();
    const { result } = renderHook(() => useSuggestions(initialEntry, onUpdateContent));

    act(() => {
      result.current.applyAnalysis(sampleAnalysis, initialEntry);
    });

    expect(result.current.activeSuggestions.length).toBe(1);

    act(() => {
      result.current.notifyManualEdit();
    });

    expect(result.current.isStale).toBe(true);
    expect(result.current.activeSuggestions.length).toBe(0);
  });
});
