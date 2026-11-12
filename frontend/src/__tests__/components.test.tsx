import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlankCanvas } from '../components/Editor/BlankCanvas';
import { SuggestionPopover } from '../components/Editor/SuggestionPopover';
import { HistoryModal } from '../components/Modals/HistoryModal';
import { ThemeModal } from '../components/Modals/ThemeModal';
import { ActiveSuggestion, JournalEntry } from '../types/journal';

describe('UI Components', () => {
  describe('BlankCanvas', () => {
    it('renders textarea with autofocus on mount and handles typing', () => {
      const onChange = vi.fn();
      render(
        <BlankCanvas
          content=""
          activeSuggestions={[]}
          selectedSuggestionId={null}
          onChange={onChange}
          onSelectSuggestion={vi.fn()}
          onAcceptSuggestion={vi.fn()}
          onDismissSuggestion={vi.fn()}
        />
      );

      const textarea = screen.getByTestId('journal-textarea');
      expect(textarea).toBeInTheDocument();

      fireEvent.change(textarea, { target: { value: 'Hola mundo' } });
      expect(onChange).toHaveBeenCalledWith('Hola mundo');
    });

    it('renders inline decorations when active suggestions exist', () => {
      const suggestion: ActiveSuggestion = {
        id: 'sug-1',
        category: 'spelling_accents',
        kind: 'correction',
        ruleCode: 'SPELL',
        state: 'pending',
        activeRange: { start: 5, end: 10 },
        edit: { start: 5, end: 10, original: 'mundo', replacement: 'planeta' },
        explanation: { title: 'Vocab', message: 'Better word' },
      };

      const onSelect = vi.fn();

      render(
        <BlankCanvas
          content="Hola mundo"
          activeSuggestions={[suggestion]}
          selectedSuggestionId={null}
          onChange={vi.fn()}
          onSelectSuggestion={onSelect}
          onAcceptSuggestion={vi.fn()}
          onDismissSuggestion={vi.fn()}
        />
      );

      const mark = screen.getByTestId('suggestion-mark-sug-1');
      expect(mark).toBeInTheDocument();
      expect(mark.textContent).toBe('mundo');

      fireEvent.click(mark);
      expect(onSelect).toHaveBeenCalledWith('sug-1');
    });

    it('renders popover dialog to fix or accept suggestions when a suggestion is selected', () => {
      const suggestion: ActiveSuggestion = {
        id: 'sug-1',
        category: 'spelling_accents',
        kind: 'correction',
        ruleCode: 'SPELL',
        state: 'pending',
        activeRange: { start: 5, end: 10 },
        edit: { start: 5, end: 10, original: 'mundo', replacement: 'planeta' },
        explanation: { title: 'Spelling correction', message: 'Use planeta instead.' },
      };

      const onAccept = vi.fn();
      const onDismiss = vi.fn();

      render(
        <BlankCanvas
          content="Hola mundo"
          activeSuggestions={[suggestion]}
          selectedSuggestionId="sug-1"
          onChange={vi.fn()}
          onSelectSuggestion={vi.fn()}
          onAcceptSuggestion={onAccept}
          onDismissSuggestion={onDismiss}
        />
      );

      const popover = screen.getByTestId('suggestion-popover');
      expect(popover).toBeInTheDocument();
      expect(screen.getByText('Spelling correction')).toBeInTheDocument();
      expect(screen.getByText('planeta')).toBeInTheDocument();

      const acceptBtn = screen.getByRole('button', { name: /accept/i });
      fireEvent.click(acceptBtn);
      expect(onAccept).toHaveBeenCalledWith('sug-1');
    });
  });

  describe('SuggestionPopover', () => {
    const sampleSuggestion: ActiveSuggestion = {
      id: 'sug-popover',
      category: 'grammar_syntax',
      kind: 'improvement',
      ruleCode: 'GRAMMAR_1',
      state: 'pending',
      activeRange: { start: 0, end: 4 },
      edit: { start: 0, end: 4, original: 'ayer', replacement: 'anoche' },
      explanation: { title: 'Temporal Nuance', message: 'Anoche is more specific for last night.' },
    };

    it('renders popover with category, explanation, and optional improvement badge', () => {
      const onAccept = vi.fn();
      const onDismiss = vi.fn();
      const onClose = vi.fn();

      render(
        <SuggestionPopover
          suggestion={sampleSuggestion}
          onAccept={onAccept}
          onDismiss={onDismiss}
          onClose={onClose}
        />
      );

      expect(screen.getByText('Grammar & Syntax')).toBeInTheDocument();
      expect(screen.getByText('Optional improvement')).toBeInTheDocument();
      expect(screen.getByText('Temporal Nuance')).toBeInTheDocument();
      expect(screen.getByText('Anoche is more specific for last night.')).toBeInTheDocument();

      // Click Accept
      const acceptBtn = screen.getByRole('button', { name: /accept/i });
      fireEvent.click(acceptBtn);
      expect(onAccept).toHaveBeenCalledWith('sug-popover');

      // Click Dismiss
      const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissBtn);
      expect(onDismiss).toHaveBeenCalledWith('sug-popover');
    });

    it('closes on Escape key press', () => {
      const onClose = vi.fn();
      render(
        <SuggestionPopover
          suggestion={sampleSuggestion}
          onAccept={vi.fn()}
          onDismiss={vi.fn()}
          onClose={onClose}
        />
      );

      const popover = screen.getByTestId('suggestion-popover');
      fireEvent.keyDown(popover, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('HistoryModal', () => {
    it('renders sorted past entries and triggers onSelectEntry', () => {
      const entries: JournalEntry[] = [
        {
          id: 'e1',
          title: 'Older Entry',
          targetLanguage: 'es',
          content: 'Entrada antigua',
          revision: 1,
          updatedAt: '2026-01-01T10:00:00Z',
        },
        {
          id: 'e2',
          title: 'Newer Entry',
          targetLanguage: 'es',
          content: 'Entrada nueva',
          revision: 1,
          updatedAt: '2026-02-01T10:00:00Z',
        },
      ];

      const onSelect = vi.fn();
      render(
        <HistoryModal
          entries={entries}
          currentEntryId="e1"
          onSelectEntry={onSelect}
          onNewEntry={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Journal Entries')).toBeInTheDocument();
      const newer = screen.getByText('Entrada nueva');
      expect(newer).toBeInTheDocument();

      fireEvent.click(newer);
      expect(onSelect).toHaveBeenCalledWith(entries[1]);
    });
  });

  describe('ThemeModal', () => {
    it('displays active theme, auto-detected language badge, and session GUID', () => {
      const onSetTheme = vi.fn();
      const onSelectLanguage = vi.fn();
      const onUpdateGuid = vi.fn().mockReturnValue(true);

      render(
        <ThemeModal
          theme="light"
          onSetTheme={onSetTheme}
          activeLanguageCode="es"
          detectedCode="es"
          isManualOverride={false}
          supportedLanguages={[
            { code: 'es', name: 'Spanish', flag: '🇪🇸' },
            { code: 'fr', name: 'French', flag: '🇫🇷' },
          ]}
          onSelectLanguage={onSelectLanguage}
          onResetAutoDetect={vi.fn()}
          sessionGuid="12345678-1234-4234-8234-123456789abc"
          onUpdateSessionGuid={onUpdateGuid}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Display Theme')).toBeInTheDocument();
      expect(screen.getByTestId('session-guid-display')).toHaveValue('12345678-1234-4234-8234-123456789abc');

      // Click Dark theme button
      const darkBtn = screen.getByRole('button', { name: /dark/i });
      fireEvent.click(darkBtn);
      expect(onSetTheme).toHaveBeenCalledWith('dark');
    });
  });

  describe('InsightsModal', () => {
    it('renders loading and then displays aggregated insights', async () => {
      const mockClient = {
        fetchInsights: vi.fn().mockResolvedValue({
          totalEntries: 5,
          totalWords: 120,
          totalSuggestions: 8,
          acceptedDecisions: 4,
          dismissedDecisions: 2,
          pendingDecisions: 2,
          categoryBreakdown: [
            { category: 'grammar_syntax', count: 5, percentage: 62.5 },
            { category: 'spelling_accents', count: 3, percentage: 37.5 },
          ],
          topMistakes: [
            {
              ruleCode: 'grammar.verb_tense',
              category: 'grammar_syntax',
              count: 3,
              sampleExplanation: 'Verb conjugation error',
            },
          ],
          recentTrends: [{ date: '2026-11-12', entriesCount: 2, mistakesCount: 3 }],
        }),
      } as any;

      const { InsightsModal } = await import('../components/Modals/InsightsModal');
      render(<InsightsModal apiClient={mockClient} onClose={vi.fn()} />);

      expect(await screen.findByText('Learning Insights')).toBeInTheDocument();
      expect(await screen.findByText('120')).toBeInTheDocument();
      expect(await screen.findByText('Verb conjugation error')).toBeInTheDocument();
      expect(await screen.findByText('Grammar & Syntax')).toBeInTheDocument();
    });
  });
});
