import { describe, expect, it } from 'vitest';
import { ActiveSuggestion, Suggestion } from '../types/journal';
import {
  applyAllPendingSuggestions,
  applySuggestion,
  getLineAndCol,
  isDeletion,
  isInsertion,
  isReplacement,
  rangesOverlap,
  validateSuggestionOffsets,
} from '../utils/offsetUtils';

describe('offsetUtils', () => {
  describe('validateSuggestionOffsets', () => {
    it('validates offsets matching slice', () => {
      const text = 'Hoy fui a la biblioteca.';
      const suggestions: Suggestion[] = [
        {
          id: 's1',
          category: 'grammar_syntax',
          kind: 'correction',
          ruleCode: 'TEST',
          edit: {
            start: 4,
            end: 7,
            original: 'fui',
            replacement: 'iba',
          },
          explanation: { title: 'Test', message: 'Test msg' },
        },
      ];

      expect(validateSuggestionOffsets(text, suggestions)).toBe(true);
    });

    it('rejects suggestions where slice does not match original', () => {
      const text = 'Hoy fui a la biblioteca.';
      const suggestions: Suggestion[] = [
        {
          id: 's1',
          category: 'grammar_syntax',
          kind: 'correction',
          ruleCode: 'TEST',
          edit: {
            start: 4,
            end: 7,
            original: 'voy', // actual is 'fui'
            replacement: 'iba',
          },
          explanation: { title: 'Test', message: 'Test msg' },
        },
      ];

      expect(validateSuggestionOffsets(text, suggestions)).toBe(false);
    });

    it('handles accents and emoji correctly in UTF-16 offsets', () => {
      // 🇪🇸 takes 4 code units
      const text = '🇪🇸 ¡Hola amigo!';
      const target = 'amigo';
      const start = text.indexOf(target);
      const end = start + target.length;

      const suggestions: Suggestion[] = [
        {
          id: 's-emoji',
          category: 'vocabulary_phrasing',
          kind: 'improvement',
          ruleCode: 'TEST',
          edit: {
            start,
            end,
            original: 'amigo',
            replacement: 'compañero',
          },
          explanation: { title: 'Test', message: 'Test msg' },
        },
      ];

      expect(validateSuggestionOffsets(text, suggestions)).toBe(true);
      expect(text.slice(start, end)).toBe('amigo');
    });
  });

  describe('isInsertion, isDeletion, isReplacement', () => {
    it('detects insertions when start === end', () => {
      expect(isInsertion({ start: 5, end: 5, original: '', replacement: 'word' })).toBe(true);
      expect(isInsertion({ start: 5, end: 6, original: 'a', replacement: 'b' })).toBe(false);
    });

    it('detects deletions when replacement is empty and start < end', () => {
      expect(isDeletion({ start: 2, end: 5, original: 'abc', replacement: '' })).toBe(true);
      expect(isDeletion({ start: 2, end: 5, original: 'abc', replacement: 'd' })).toBe(false);
    });

    it('detects replacements when start < end and replacement is non-empty', () => {
      expect(isReplacement({ start: 2, end: 5, original: 'abc', replacement: 'xyz' })).toBe(true);
      expect(isReplacement({ start: 2, end: 5, original: 'abc', replacement: '' })).toBe(false);
    });
  });

  describe('rangesOverlap', () => {
    it('detects overlapping ranges and identical insertion positions', () => {
      expect(rangesOverlap({ start: 2, end: 6 }, { start: 4, end: 8 })).toBe(true);
      expect(rangesOverlap({ start: 2, end: 6 }, { start: 6, end: 8 })).toBe(false);
      expect(rangesOverlap({ start: 5, end: 5 }, { start: 5, end: 5 })).toBe(true);
    });
  });

  describe('applySuggestion and Offset Shifting', () => {
    it('shifts subsequent suggestions offsets by replacement-length difference', () => {
      // Original text: "El perro corre en el parque"
      // Suggestion 1: replace "perro" (len 5) with "perro grande" (len 12) -> delta = +7
      // Suggestion 2: replace "parque" (start 21, end 27) with "jardín"
      const text = 'El perro corre en el parque';

      const s1: ActiveSuggestion = {
        id: 's1',
        category: 'vocabulary_phrasing',
        kind: 'improvement',
        ruleCode: 'ADJECTIVE',
        state: 'pending',
        activeRange: { start: 3, end: 8 },
        edit: { start: 3, end: 8, original: 'perro', replacement: 'perro grande' },
        explanation: { title: 'T1', message: 'M1' },
      };

      const s2: ActiveSuggestion = {
        id: 's2',
        category: 'spelling_accents',
        kind: 'correction',
        ruleCode: 'PARK',
        state: 'pending',
        activeRange: { start: 21, end: 27 },
        edit: { start: 21, end: 27, original: 'parque', replacement: 'jardín' },
        explanation: { title: 'T2', message: 'M2' },
      };

      const result = applySuggestion(text, [s1, s2], 's1');

      expect(result.success).toBe(true);
      expect(result.newText).toBe('El perro grande corre en el parque');

      const updatedS1 = result.updatedSuggestions.find((s) => s.id === 's1');
      const updatedS2 = result.updatedSuggestions.find((s) => s.id === 's2');

      expect(updatedS1?.state).toBe('accepted');
      // s2 should be shifted by +7
      expect(updatedS2?.activeRange.start).toBe(21 + 7);
      expect(updatedS2?.activeRange.end).toBe(27 + 7);

      // Verify shifted s2 slice matches original expected text in the new text
      expect(result.newText.slice(updatedS2!.activeRange.start, updatedS2!.activeRange.end)).toBe('parque');
    });

    it('rejects suggestions that overlap with the accepted edit', () => {
      const text = 'El perro negro corre';
      const s1: ActiveSuggestion = {
        id: 's1',
        category: 'grammar_syntax',
        kind: 'correction',
        ruleCode: 'R1',
        state: 'pending',
        activeRange: { start: 3, end: 8 },
        edit: { start: 3, end: 8, original: 'perro', replacement: 'gato' },
        explanation: { title: 'T1', message: 'M1' },
      };

      const s2Overlap: ActiveSuggestion = {
        id: 's2',
        category: 'vocabulary_phrasing',
        kind: 'improvement',
        ruleCode: 'R2',
        state: 'pending',
        activeRange: { start: 6, end: 14 }, // Overlaps with [3, 8]
        edit: { start: 6, end: 14, original: 'ro negro', replacement: 'ro blanco' },
        explanation: { title: 'T2', message: 'M2' },
      };

      const result = applySuggestion(text, [s1, s2Overlap], 's1');
      expect(result.success).toBe(true);

      const updatedS2 = result.updatedSuggestions.find((s) => s.id === 's2');
      expect(updatedS2?.state).toBe('dismissed');
    });
  });

  describe('getLineAndCol', () => {
    it('returns Line 1 Col 1 for start of text', () => {
      const text = 'Hello world';
      expect(getLineAndCol(text, 0)).toEqual({ line: 1, col: 1 });
    });

    it('calculates correct line and column across multiline text', () => {
      const text = 'Line 1\nLine 2\nLine 3 with words';
      // Offset of 'with' in Line 3
      const offset = text.indexOf('with');
      expect(getLineAndCol(text, offset)).toEqual({ line: 3, col: 8 });
    });

    it('clamps negative or out-of-range offsets gracefully', () => {
      const text = 'Short';
      expect(getLineAndCol(text, -5)).toEqual({ line: 1, col: 1 });
      expect(getLineAndCol(text, 999)).toEqual({ line: 1, col: 6 });
    });
  });

  describe('applyAllPendingSuggestions', () => {
    it('applies multiple non-overlapping suggestions right-to-left accurately', () => {
      const text = 'Yo tener hambre y mis amigo llegaron.';
      const s1: ActiveSuggestion = {
        id: 's1',
        category: 'grammar_syntax',
        kind: 'correction',
        ruleCode: 'G1',
        state: 'pending',
        activeRange: { start: 3, end: 8 },
        edit: { start: 3, end: 8, original: 'tener', replacement: 'tenía' },
        explanation: { title: 'T1', message: 'M1' },
      };
      const s2: ActiveSuggestion = {
        id: 's2',
        category: 'grammar_syntax',
        kind: 'correction',
        ruleCode: 'G2',
        state: 'pending',
        activeRange: { start: 22, end: 27 },
        edit: { start: 22, end: 27, original: 'amigo', replacement: 'amigos' },
        explanation: { title: 'T2', message: 'M2' },
      };

      const result = applyAllPendingSuggestions(text, [s1, s2]);
      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(2);
      expect(result.newText).toBe('Yo tenía hambre y mis amigos llegaron.');
      expect(result.updatedSuggestions.every((s) => s.state === 'accepted')).toBe(true);
    });
  });
});
