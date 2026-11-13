import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusIndicator } from '../components/Editor/StatusIndicator';
import { SideReviewPanel } from '../components/Review/SideReviewPanel';
import { SuggestionCard } from '../components/Review/SuggestionCard';
import { ActiveSuggestion } from '../types/journal';

describe('SideReviewPanel & SuggestionCard', () => {
  const mockSuggestions: ActiveSuggestion[] = [
    {
      id: 's1',
      category: 'grammar_syntax',
      kind: 'correction',
      ruleCode: 'G_VERB',
      state: 'pending',
      activeRange: { start: 3, end: 8 },
      edit: { start: 3, end: 8, original: 'tener', replacement: 'tenía' },
      explanation: { title: 'Verb Agreement', message: 'Conjugate in past imperfect.' },
    },
    {
      id: 's2',
      category: 'vocabulary_phrasing',
      kind: 'improvement',
      ruleCode: 'V_WORD',
      state: 'pending',
      activeRange: { start: 16, end: 21 },
      edit: { start: 16, end: 21, original: 'comer', replacement: 'cenar' },
      explanation: { title: 'Natural Phrasing', message: 'Use cenar for dinner.' },
    },
    {
      id: 's3',
      category: 'spelling_accents',
      kind: 'correction',
      ruleCode: 'S_ACCENT',
      state: 'pending',
      activeRange: { start: 25, end: 28 },
      edit: { start: 25, end: 28, original: 'dia', replacement: 'día' },
      explanation: { title: 'Missing Accent', message: 'Needs accent on the i.' },
    },
  ];

  const contentText = 'Yo tener ganas de comer el dia siguiente.';

  beforeEach(() => {
    // Mock scrollIntoView in jsdom
    Element.prototype.scrollIntoView = vi.fn();
  });

  describe('SideReviewPanel', () => {
    it('does not render when isOpen is false', () => {
      render(
        <SideReviewPanel
          isOpen={false}
          onClose={vi.fn()}
          activeSuggestions={mockSuggestions}
          selectedSuggestionId={null}
          content={contentText}
          isStale={false}
          onSelectSuggestion={vi.fn()}
          onAcceptSuggestion={vi.fn()}
          onDismissSuggestion={vi.fn()}
          onAcceptAll={vi.fn()}
          onDismissAll={vi.fn()}
          onReviewAgain={vi.fn()}
        />
      );

      expect(screen.queryByTestId('side-review-panel')).toBeNull();
    });

    it('renders panel with header, badge count, and all pending suggestions when open', () => {
      render(
        <SideReviewPanel
          isOpen={true}
          onClose={vi.fn()}
          activeSuggestions={mockSuggestions}
          selectedSuggestionId={null}
          content={contentText}
          isStale={false}
          onSelectSuggestion={vi.fn()}
          onAcceptSuggestion={vi.fn()}
          onDismissSuggestion={vi.fn()}
          onAcceptAll={vi.fn()}
          onDismissAll={vi.fn()}
          onReviewAgain={vi.fn()}
        />
      );

      expect(screen.getByTestId('side-review-panel')).toBeInTheDocument();
      expect(screen.getByText('AI Corrections')).toBeInTheDocument();
      expect(screen.getByTestId('pending-count-badge')).toHaveTextContent('3');

      // 3 cards rendered
      expect(screen.getByTestId('suggestion-card-s1')).toBeInTheDocument();
      expect(screen.getByTestId('suggestion-card-s2')).toBeInTheDocument();
      expect(screen.getByTestId('suggestion-card-s3')).toBeInTheDocument();
    });

    it('filters suggestions when clicking category tabs', () => {
      render(
        <SideReviewPanel
          isOpen={true}
          onClose={vi.fn()}
          activeSuggestions={mockSuggestions}
          selectedSuggestionId={null}
          content={contentText}
          isStale={false}
          onSelectSuggestion={vi.fn()}
          onAcceptSuggestion={vi.fn()}
          onDismissSuggestion={vi.fn()}
          onAcceptAll={vi.fn()}
          onDismissAll={vi.fn()}
          onReviewAgain={vi.fn()}
        />
      );

      // Click Grammar tab
      const grammarTab = screen.getByTestId('filter-tab-grammar');
      fireEvent.click(grammarTab);

      expect(screen.getByTestId('suggestion-card-s1')).toBeInTheDocument();
      expect(screen.queryByTestId('suggestion-card-s2')).toBeNull();
      expect(screen.queryByTestId('suggestion-card-s3')).toBeNull();

      // Click All tab
      const allTab = screen.getByTestId('filter-tab-all');
      fireEvent.click(allTab);
      expect(screen.getByTestId('suggestion-card-s1')).toBeInTheDocument();
      expect(screen.getByTestId('suggestion-card-s2')).toBeInTheDocument();
      expect(screen.getByTestId('suggestion-card-s3')).toBeInTheDocument();
    });

    it('triggers batch action callbacks when clicking Accept All and Dismiss All', () => {
      const onAcceptAll = vi.fn();
      const onDismissAll = vi.fn();

      render(
        <SideReviewPanel
          isOpen={true}
          onClose={vi.fn()}
          activeSuggestions={mockSuggestions}
          selectedSuggestionId={null}
          content={contentText}
          isStale={false}
          onSelectSuggestion={vi.fn()}
          onAcceptSuggestion={vi.fn()}
          onDismissSuggestion={vi.fn()}
          onAcceptAll={onAcceptAll}
          onDismissAll={onDismissAll}
          onReviewAgain={vi.fn()}
        />
      );

      const acceptAllBtn = screen.getByTestId('accept-all-btn');
      expect(acceptAllBtn).toHaveTextContent('Accept All (3)');
      fireEvent.click(acceptAllBtn);
      expect(onAcceptAll).toHaveBeenCalledTimes(1);

      const dismissAllBtn = screen.getByTestId('dismiss-all-btn');
      fireEvent.click(dismissAllBtn);
      expect(onDismissAll).toHaveBeenCalledTimes(1);
    });

    it('displays stale warning banner when isStale is true and triggers re-review', () => {
      const onReviewAgain = vi.fn();

      render(
        <SideReviewPanel
          isOpen={true}
          onClose={vi.fn()}
          activeSuggestions={mockSuggestions}
          selectedSuggestionId={null}
          content={contentText}
          isStale={true}
          onSelectSuggestion={vi.fn()}
          onAcceptSuggestion={vi.fn()}
          onDismissSuggestion={vi.fn()}
          onAcceptAll={vi.fn()}
          onDismissAll={vi.fn()}
          onReviewAgain={onReviewAgain}
        />
      );

      expect(screen.getByTestId('panel-stale-banner')).toBeInTheDocument();
      const reviewAgainBtn = screen.getByRole('button', { name: /Review again/i });
      fireEvent.click(reviewAgainBtn);
      expect(onReviewAgain).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(
        <SideReviewPanel
          isOpen={true}
          onClose={onClose}
          activeSuggestions={mockSuggestions}
          selectedSuggestionId={null}
          content={contentText}
          isStale={false}
          onSelectSuggestion={vi.fn()}
          onAcceptSuggestion={vi.fn()}
          onDismissSuggestion={vi.fn()}
          onAcceptAll={vi.fn()}
          onDismissAll={vi.fn()}
          onReviewAgain={vi.fn()}
        />
      );

      const closeBtn = screen.getByTestId('close-review-panel-btn');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('SuggestionCard Click-to-Jump Navigation', () => {
    it('triggers onSelect and scrollIntoView when card is clicked', () => {
      // Create dummy target in document to simulate editor mark
      const mark = document.createElement('mark');
      mark.setAttribute('data-testid', 'suggestion-mark-s1');
      document.body.appendChild(mark);

      const onSelect = vi.fn();
      const onAccept = vi.fn();
      const onDismiss = vi.fn();

      render(
        <SuggestionCard
          suggestion={mockSuggestions[0]}
          index={1}
          content={contentText}
          isSelected={false}
          onSelect={onSelect}
          onAccept={onAccept}
          onDismiss={onDismiss}
        />
      );

      const card = screen.getByTestId('suggestion-card-s1');
      fireEvent.click(card);

      expect(onSelect).toHaveBeenCalledWith('s1');
      expect(mark.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });

      document.body.removeChild(mark);
    });

    it('triggers onAccept when Accept button is clicked without bubbling card click', () => {
      const onSelect = vi.fn();
      const onAccept = vi.fn();

      render(
        <SuggestionCard
          suggestion={mockSuggestions[0]}
          index={1}
          content={contentText}
          isSelected={false}
          onSelect={onSelect}
          onAccept={onAccept}
          onDismiss={vi.fn()}
        />
      );

      const acceptBtn = screen.getByTestId('accept-btn-s1');
      fireEvent.click(acceptBtn);

      expect(onAccept).toHaveBeenCalledWith('s1');
    });

    it('triggers onDismiss when Dismiss button is clicked', () => {
      const onDismiss = vi.fn();

      render(
        <SuggestionCard
          suggestion={mockSuggestions[0]}
          index={1}
          content={contentText}
          isSelected={false}
          onSelect={vi.fn()}
          onAccept={vi.fn()}
          onDismiss={onDismiss}
        />
      );

      const dismissBtn = screen.getByTestId('dismiss-btn-s1');
      fireEvent.click(dismissBtn);

      expect(onDismiss).toHaveBeenCalledWith('s1');
    });
  });

  describe('StatusIndicator Side Panel Toggle', () => {
    it('renders side panel toggle button in status bar and handles clicks', () => {
      const onToggle = vi.fn();

      render(
        <StatusIndicator
          wordCount={8}
          language={{ code: 'es', name: 'Spanish', flag: '🇪🇸' }}
          isAutoDetected={true}
          isDirty={false}
          isStale={false}
          isLoading={false}
          pendingSuggestionsCount={3}
          isSidePanelOpen={false}
          onToggleSidePanel={onToggle}
          onOpenSettings={vi.fn()}
          onOpenHelp={vi.fn()}
          onReview={vi.fn()}
        />
      );

      const toggleBtn = screen.getByTestId('toggle-side-panel-btn');
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveTextContent('3 fixes');

      fireEvent.click(toggleBtn);
      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });
});
