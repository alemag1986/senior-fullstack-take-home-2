import { Analysis, JournalEntry, Suggestion } from '../types/journal';
import {
  getCleanEntryFixture,
  getInsertionsDeletionsFixture,
  getMultiCategoryFixture,
  getRepeatedWordsFixture,
  getUnicodeEmojiFixture,
} from '../utils/fixtureGenerator';
import { validateSuggestionOffsets } from '../utils/offsetUtils';

export interface AnalyzeOptions {
  forceFailure?: boolean;
  delayMs?: number;
}

/**
 * Analyzes a journal entry and returns an Analysis result.
 * Completely decoupled from UI components.
 *
 * If the user's text matches one of the known deterministic fixtures,
 * it returns that fixture's validated suggestions.
 * Otherwise, it performs a lightweight heuristic rule check (e.g. common Spanish errors)
 * ensuring all generated offsets satisfy sourceText.slice(start, end) === original.
 * Clearly identifies results as mock/demo feedback.
 */
export async function analyzeEntry(
  entry: JournalEntry,
  options: AnalyzeOptions = {}
): Promise<Analysis> {
  const { forceFailure = false, delayMs = 600 } = options;

  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  if (forceFailure) {
    return {
      id: `analysis-err-${Date.now()}`,
      entryId: entry.id,
      entryRevision: entry.revision,
      sourceText: entry.content,
      status: 'failed',
      offsetEncoding: 'utf-16',
      suggestions: [],
      error: 'Simulation Error: Could not connect to the feedback service. Please try again.',
      isMock: true,
    };
  }

  // Check if content matches any deterministic sample fixture
  const fixtures = [
    getMultiCategoryFixture(),
    getInsertionsDeletionsFixture(),
    getUnicodeEmojiFixture(),
    getRepeatedWordsFixture(),
    getCleanEntryFixture(),
  ];

  for (const f of fixtures) {
    if (entry.content.trim() === f.entry.content.trim()) {
      return {
        ...f.analysis,
        id: `analysis-${Date.now()}`,
        entryId: entry.id,
        entryRevision: entry.revision,
        sourceText: entry.content,
        isMock: true,
      };
    }
  }

  // Dynamic heuristic rules for arbitrary user text in Spanish/foreign practice
  const suggestions: Suggestion[] = [];
  const text = entry.content;

  // Rule 1: Accents - common missing accents in Spanish
  const accentRules: Array<{ word: string; replacement: string; title: string; message: string }> = [
    { word: 'esta manana', replacement: 'esta mañana', title: 'Letra "ñ"', message: 'En español se escribe "mañana" con eñe.' },
    { word: 'tambien', replacement: 'también', title: 'Tilde en aguda', message: '"También" es una palabra aguda terminada en "n", por lo que lleva tilde.' },
    { word: 'despues', replacement: 'después', title: 'Tilde en aguda', message: '"Después" es una palabra aguda terminada en "s", por lo que lleva tilde.' },
    { word: 'mas', replacement: 'más', title: 'Tilde diacrítica', message: 'Como adverbio de cantidad, "más" lleva tilde diacrítica.' },
    { word: 'facil', replacement: 'fácil', title: 'Tilde en llana', message: '"Fácil" es una palabra llana terminada en "l", por lo que lleva tilde.' },
  ];

  for (const rule of accentRules) {
    let searchPos = 0;
    while (searchPos < text.length) {
      const idx = text.toLowerCase().indexOf(rule.word, searchPos);
      if (idx === -1) break;
      const originalSlice = text.slice(idx, idx + rule.word.length);
      suggestions.push({
        id: `dyn-accent-${suggestions.length + 1}`,
        category: 'spelling_accents',
        kind: 'correction',
        ruleCode: 'MISSING_ACCENT',
        edit: {
          start: idx,
          end: idx + rule.word.length,
          original: originalSlice,
          replacement: rule.replacement,
        },
        explanation: {
          title: rule.title,
          message: rule.message,
        },
      });
      searchPos = idx + rule.word.length;
    }
  }

  // Rule 2: Grammar & Syntax - common contractions like "a el" -> "al", "de el" -> "del"
  const grammarRules: Array<{ regex: RegExp; replacement: string; title: string; message: string }> = [
    { regex: /\ba el\b/gi, replacement: 'al', title: 'Contracción obligatoria', message: 'La preposición "a" más el artículo "el" forman la contracción obligatoria "al".' },
    { regex: /\bde el\b/gi, replacement: 'del', title: 'Contracción obligatoria', message: 'La preposición "de" más el artículo "el" forman la contracción obligatoria "del".' },
  ];

  for (const rule of grammarRules) {
    let match: RegExpExecArray | null;
    while ((match = rule.regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      suggestions.push({
        id: `dyn-grammar-${suggestions.length + 1}`,
        category: 'grammar_syntax',
        kind: 'correction',
        ruleCode: 'MANDATORY_CONTRACTION',
        edit: {
          start,
          end,
          original: match[0],
          replacement: rule.replacement,
        },
        explanation: {
          title: rule.title,
          message: rule.message,
        },
      });
    }
  }

  // Validate all generated offsets before returning
  validateSuggestionOffsets(text, suggestions);

  return {
    id: `analysis-dyn-${Date.now()}`,
    entryId: entry.id,
    entryRevision: entry.revision,
    sourceText: text,
    status: 'completed',
    offsetEncoding: 'utf-16',
    suggestions,
    isMock: true,
  };
}
