export type FeedbackCategory = 'grammar_syntax' | 'vocabulary_phrasing' | 'spelling_accents';
export type SuggestionKind = 'correction' | 'improvement';
export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';
export type SuggestionState = 'pending' | 'accepted' | 'dismissed';
export type ThemeMode = 'light' | 'dark' | 'sepia';

export interface JournalEntry {
  id: string;
  title: string;
  targetLanguage: string;
  content: string; // Plain text source of truth
  revision: number; // Incremented on edits / accepted suggestions
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface SuggestionEdit {
  start: number;       // UTF-16 zero-based, start-inclusive
  end: number;         // UTF-16 zero-based, end-exclusive
  original: string;    // Invariant: sourceText.slice(start, end) === original
  replacement: string; // Replacement string (empty for deletions)
}

export interface SuggestionExplanation {
  title: string;
  message: string;
}

export interface Suggestion {
  id: string;
  category: FeedbackCategory;
  ruleCode: string;
  kind: SuggestionKind;
  edit: SuggestionEdit;
  explanation: SuggestionExplanation;
}

export interface Analysis {
  id: string;
  entryId: string;
  entryRevision: number;
  sourceText: string;
  status: AnalysisStatus;
  offsetEncoding: 'utf-16';
  suggestions: Suggestion[];
  error?: string;
  isMock?: boolean;
}

export interface ActiveSuggestion extends Suggestion {
  state: SuggestionState;
  activeRange: {
    start: number;
    end: number;
  };
}

export interface DiffPart {
  type: 'equal' | 'delete' | 'insert';
  value: string;
}

export interface CategoryStat {
  category: FeedbackCategory;
  count: number;
  percentage: number;
}

export interface MistakePattern {
  ruleCode: string;
  category: FeedbackCategory;
  count: number;
  sampleExplanation: string;
}

export interface TrendPoint {
  date: string;
  entriesCount: number;
  mistakesCount: number;
}

export interface InsightsData {
  totalEntries: number;
  totalWords: number;
  totalSuggestions: number;
  acceptedDecisions: number;
  dismissedDecisions: number;
  pendingDecisions: number;
  categoryBreakdown: CategoryStat[];
  topMistakes: MistakePattern[];
  recentTrends: TrendPoint[];
}
