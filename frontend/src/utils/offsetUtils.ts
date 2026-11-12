import { ActiveSuggestion, Suggestion, SuggestionEdit } from '../types/journal';

/**
 * Validates that all suggestions satisfy the invariant:
 * sourceText.slice(start, end) === original
 * and bounds are zero-based, start-inclusive, end-exclusive.
 */
export function validateSuggestionOffsets(sourceText: string, suggestions: Suggestion[]): boolean {
  for (const s of suggestions) {
    const { start, end, original } = s.edit;
    if (start < 0 || end < start || end > sourceText.length) {
      return false;
    }
    if (sourceText.slice(start, end) !== original) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if a suggestion represents an insertion (caret marker at start === end).
 */
export function isInsertion(edit: SuggestionEdit): boolean {
  return edit.start === edit.end;
}

/**
 * Checks if a suggestion represents a deletion (replacement is empty).
 */
export function isDeletion(edit: SuggestionEdit): boolean {
  return edit.start < edit.end && edit.replacement === '';
}

/**
 * Checks if a suggestion represents a replacement.
 */
export function isReplacement(edit: SuggestionEdit): boolean {
  return edit.start < edit.end && edit.replacement.length > 0;
}

/**
 * Checks if two range spans overlap.
 * Insertions at the same position are considered colliding.
 */
export function rangesOverlap(
  r1: { start: number; end: number },
  r2: { start: number; end: number }
): boolean {
  if (r1.start === r1.end && r2.start === r2.end) {
    return r1.start === r2.start;
  }
  return Math.max(r1.start, r2.start) < Math.min(r1.end, r2.end);
}

export interface ApplySuggestionResult {
  success: boolean;
  newText: string;
  updatedSuggestions: ActiveSuggestion[];
  error?: string;
}

/**
 * Applies an accepted suggestion:
 * 1. Verifies the active range matches original text.
 * 2. Replaces range with replacement text.
 * 3. Shifts active offsets of subsequent suggestions by delta = (replacement.length - original.length).
 * 4. Preserves unaffected suggestions and rejects overlapping ones.
 */
export function applySuggestion(
  currentText: string,
  activeSuggestions: ActiveSuggestion[],
  targetSuggestionId: string
): ApplySuggestionResult {
  const target = activeSuggestions.find((s) => s.id === targetSuggestionId);
  if (!target || target.state !== 'pending') {
    return {
      success: false,
      newText: currentText,
      updatedSuggestions: activeSuggestions,
      error: 'Suggestion not found or not pending.',
    };
  }

  const { start, end } = target.activeRange;
  const { original, replacement } = target.edit;

  // Verify slice matches original expected text
  if (currentText.slice(start, end) !== original) {
    return {
      success: false,
      newText: currentText,
      updatedSuggestions: activeSuggestions,
      error: `Text mismatch: expected "${original}" at [${start}, ${end}], found "${currentText.slice(start, end)}"`,
    };
  }

  const newText = currentText.slice(0, start) + replacement + currentText.slice(end);
  const delta = replacement.length - original.length;

  const updatedSuggestions: ActiveSuggestion[] = [];

  for (const s of activeSuggestions) {
    if (s.id === targetSuggestionId) {
      updatedSuggestions.push({
        ...s,
        state: 'accepted',
      });
      continue;
    }

    if (s.state !== 'pending') {
      updatedSuggestions.push(s);
      continue;
    }

    // Check if it overlaps with the applied edit
    if (rangesOverlap(s.activeRange, { start, end })) {
      // Overlapping suggestion becomes invalid/dismissed
      updatedSuggestions.push({
        ...s,
        state: 'dismissed',
      });
      continue;
    }

    // Subsequent suggestions shift by delta
    if (s.activeRange.start >= end) {
      updatedSuggestions.push({
        ...s,
        activeRange: {
          start: s.activeRange.start + delta,
          end: s.activeRange.end + delta,
        },
      });
    } else {
      // Preceding unaffected suggestions stay the same
      updatedSuggestions.push(s);
    }
  }

  return {
    success: true,
    newText,
    updatedSuggestions,
  };
}
