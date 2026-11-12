import { describe, expect, it } from 'vitest';
import { ActiveSuggestion } from '../types/journal';
import { computeWordDiff, deriveProposedText } from '../utils/diffUtils';

describe('diffUtils', () => {
  describe('deriveProposedText', () => {
    it('applies pending suggestions right-to-left accurately', () => {
      const text = 'Hoy fui a la biblioteka pero no tenia mi libro.';

      const s1: ActiveSuggestion = {
        id: 's1',
        category: 'spelling_accents',
        kind: 'correction',
        ruleCode: 'C1',
        state: 'pending',
        activeRange: { start: 13, end: 23 },
        edit: { start: 13, end: 23, original: 'biblioteka', replacement: 'biblioteca' },
        explanation: { title: 'T1', message: 'M1' },
      };

      const s2: ActiveSuggestion = {
        id: 's2',
        category: 'spelling_accents',
        kind: 'correction',
        ruleCode: 'C2',
        state: 'pending',
        activeRange: { start: 32, end: 37 },
        edit: { start: 32, end: 37, original: 'tenia', replacement: 'tenía' },
        explanation: { title: 'T2', message: 'M2' },
      };

      const s3Dismissed: ActiveSuggestion = {
        id: 's3',
        category: 'vocabulary_phrasing',
        kind: 'improvement',
        ruleCode: 'C3',
        state: 'dismissed', // Dismissed: must NOT be applied
        activeRange: { start: 41, end: 46 },
        edit: { start: 41, end: 46, original: 'libro', replacement: 'cuaderno' },
        explanation: { title: 'T3', message: 'M3' },
      };

      const proposed = deriveProposedText(text, [s1, s2, s3Dismissed]);

      expect(proposed).toBe('Hoy fui a la biblioteca pero no tenía mi libro.');
    });
  });

  describe('computeWordDiff', () => {
    it('computes word-level diff showing equal, delete and insert tokens', () => {
      const textA = 'Hoy fui a la biblioteka.';
      const textB = 'Hoy fui a la biblioteca.';

      const diff = computeWordDiff(textA, textB);

      expect(diff.length).toBeGreaterThan(0);
      expect(diff.some((p) => p.type === 'delete' && p.value.includes('biblioteka'))).toBe(true);
      expect(diff.some((p) => p.type === 'insert' && p.value.includes('biblioteca'))).toBe(true);
      expect(diff.some((p) => p.type === 'equal' && p.value.includes('Hoy fui'))).toBe(true);
    });
  });
});
