import { describe, expect, it } from 'vitest';
import {
  getCleanEntryFixture,
  getInsertionsDeletionsFixture,
  getMultiCategoryFixture,
  getRepeatedWordsFixture,
  getUnicodeEmojiFixture,
} from '../utils/fixtureGenerator';
import { validateSuggestionOffsets } from '../utils/offsetUtils';

describe('fixtureGenerator', () => {
  it('validates multi-category fixture offsets against sourceText', () => {
    const fixture = getMultiCategoryFixture();
    expect(validateSuggestionOffsets(fixture.entry.content, fixture.analysis.suggestions)).toBe(true);
    expect(fixture.analysis.suggestions.length).toBe(3);
    expect(fixture.analysis.isMock).toBe(true);
  });

  it('validates insertions and deletions fixture offsets', () => {
    const fixture = getInsertionsDeletionsFixture();
    expect(validateSuggestionOffsets(fixture.entry.content, fixture.analysis.suggestions)).toBe(true);
    const hasInsertion = fixture.analysis.suggestions.some((s) => s.edit.start === s.edit.end);
    const hasDeletion = fixture.analysis.suggestions.some((s) => s.edit.start < s.edit.end && s.edit.replacement === '');
    expect(hasInsertion).toBe(true);
    expect(hasDeletion).toBe(true);
  });

  it('validates unicode and emoji UTF-16 offset precision', () => {
    const fixture = getUnicodeEmojiFixture();
    expect(validateSuggestionOffsets(fixture.entry.content, fixture.analysis.suggestions)).toBe(true);
  });

  it('validates repeated words targeting correct occurrence', () => {
    const fixture = getRepeatedWordsFixture();
    expect(validateSuggestionOffsets(fixture.entry.content, fixture.analysis.suggestions)).toBe(true);
  });

  it('validates clean entry produces zero suggestions', () => {
    const fixture = getCleanEntryFixture();
    expect(fixture.analysis.suggestions.length).toBe(0);
  });
});
