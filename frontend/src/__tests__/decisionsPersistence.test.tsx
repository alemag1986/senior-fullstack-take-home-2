import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from '../App';

describe('Corrections & Grammar Fix Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('journal_session_guid', 'user-test-persistence');
  });

  it('persists accepted single grammar fix to backend decisions and updates state', async () => {
    const entryId = 'entry-test-1';
    const mockEntry = {
      id: entryId,
      title: 'Grammar Practice',
      targetLanguage: 'es',
      content: 'Yo comer manzanas ayer.',
      revision: 1,
      createdAt: '2026-11-13T10:00:00Z',
      updatedAt: '2026-11-13T10:00:00Z',
    };

    let decisionPayload: any = null;

    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith('/api/entries')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockEntry]),
        });
      }
      if (url.endsWith('/api/entries/analyze')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'ana-1',
              entryId: entryId,
              entryRevision: 1,
              sourceText: 'Yo comer manzanas ayer.',
              status: 'completed',
              suggestions: [
                {
                  id: 'sug-verb-1',
                  category: 'grammar_syntax',
                  ruleCode: 'grammar.verb_tense',
                  kind: 'correction',
                  edit: {
                    start: 3,
                    end: 8,
                    original: 'comer',
                    replacement: 'comí',
                  },
                  explanation: {
                    title: 'Pretérito Indefinido',
                    message: 'Usa "comí" en pasado.',
                  },
                },
              ],
            }),
        });
      }
      if (url.includes('/decisions')) {
        decisionPayload = JSON.parse(options?.body as string);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              entry: {
                ...mockEntry,
                content: 'Yo comí manzanas ayer.',
                revision: 2,
                updatedAt: '2026-11-13T10:05:00Z',
              },
              actions: [
                {
                  id: 'act-1',
                  suggestionId: 'sug-verb-1',
                  action: 'accepted',
                  resultingEntryRevision: 2,
                  createdAt: '2026-11-13T10:05:00Z',
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as any;

    const { unmount } = render(<App />);

    // Wait for initial sync
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Type text into editor
    const textarea = screen.getByTestId('journal-textarea');
    fireEvent.change(textarea, { target: { value: 'Yo comer manzanas ayer.' } });

    // Trigger AI Review via keyboard shortcut Ctrl+Enter
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
      await new Promise((r) => setTimeout(r, 50));
    });

    // Side review panel opens with suggestion card
    expect(screen.getByTestId('suggestion-card-sug-verb-1')).toBeInTheDocument();

    // Click Accept button on suggestion card
    const acceptBtn = screen.getByTestId('accept-btn-sug-verb-1');
    await act(async () => {
      fireEvent.click(acceptBtn);
    });

    // Verify submitDecisions was called with expected revision 1
    expect(decisionPayload).not.toBeNull();
    expect(decisionPayload.expectedRevision).toBe(1);
    expect(decisionPayload.decisions).toEqual([
      { suggestionId: 'sug-verb-1', action: 'accepted' },
    ]);

    // Verify editor has updated text
    expect(screen.getByTestId('journal-textarea')).toHaveValue('Yo comí manzanas ayer.');

    // Verify localStorage history is updated with the corrected entry
    const history = JSON.parse(
      localStorage.getItem('journal_history_user-test-persistence') || '[]'
    );
    expect(history.length).toBeGreaterThan(0);
    const updatedEntryInHistory = history.find((e: any) => e.id === entryId || e.content.includes('comí'));
    expect(updatedEntryInHistory).toBeDefined();
    expect(updatedEntryInHistory.content).toBe('Yo comí manzanas ayer.');
    expect(updatedEntryInHistory.revision).toBe(2);

    unmount();
  });

  it('persists batch Accept All decisions in a single atomic request', async () => {
    const entryId = 'entry-test-batch';
    const mockEntry = {
      id: entryId,
      title: 'Batch Practice',
      targetLanguage: 'es',
      content: 'Yo comer manzanas ayer.',
      revision: 1,
      createdAt: '2026-11-13T10:00:00Z',
      updatedAt: '2026-11-13T10:00:00Z',
    };

    let decisionCalls: any[] = [];

    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith('/api/entries')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockEntry]),
        });
      }
      if (url.endsWith('/api/entries/analyze')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'ana-batch-1',
              entryId: entryId,
              entryRevision: 1,
              sourceText: 'Yo comer manzanas ayer.',
              status: 'completed',
              suggestions: [
                {
                  id: 'sug-1',
                  category: 'grammar_syntax',
                  ruleCode: 'grammar.verb_tense',
                  kind: 'correction',
                  edit: { start: 3, end: 8, original: 'comer', replacement: 'comí' },
                  explanation: { title: 'Pretérito', message: 'Usa comí.' },
                },
                {
                  id: 'sug-2',
                  category: 'vocabulary_phrasing',
                  ruleCode: 'vocabulary.word_choice',
                  kind: 'improvement',
                  edit: { start: 18, end: 23, original: 'ayer.', replacement: 'antier.' },
                  explanation: { title: 'Vocabulario', message: 'Usa antier.' },
                },
              ],
            }),
        });
      }
      if (url.includes('/decisions')) {
        const payload = JSON.parse(options?.body as string);
        decisionCalls.push(payload);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              entry: {
                ...mockEntry,
                content: 'Yo comí manzanas antier.',
                revision: 2,
                updatedAt: '2026-11-13T10:05:00Z',
              },
              actions: [
                { id: 'act-1', suggestionId: 'sug-1', action: 'accepted', resultingEntryRevision: 2 },
                { id: 'act-2', suggestionId: 'sug-2', action: 'accepted', resultingEntryRevision: 2 },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as any;

    const { unmount } = render(<App />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const textarea = screen.getByTestId('journal-textarea');
    fireEvent.change(textarea, { target: { value: 'Yo comer manzanas ayer.' } });

    // Trigger AI Review via keyboard shortcut Ctrl+Enter
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
      await new Promise((r) => setTimeout(r, 50));
    });

    // Accept All button in side review panel
    const acceptAllBtn = screen.getByTestId('accept-all-btn');
    await act(async () => {
      fireEvent.click(acceptAllBtn);
    });

    // Verify it sent exactly 1 atomic batch request with both decisions
    expect(decisionCalls).toHaveLength(1);
    expect(decisionCalls[0].expectedRevision).toBe(1);
    expect(decisionCalls[0].decisions).toHaveLength(2);
    expect(decisionCalls[0].decisions).toEqual([
      { suggestionId: 'sug-1', action: 'accepted' },
      { suggestionId: 'sug-2', action: 'accepted' },
    ]);

    // Verify editor has final reconstructed text
    expect(screen.getByTestId('journal-textarea')).toHaveValue('Yo comí manzanas antier.');

    unmount();
  });
});
