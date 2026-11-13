import { ActiveSuggestion, DiffPart } from '../types/journal';

/**
 * Derives the corrected preview text by applying pending, valid suggestions
 * from right to left (descending order of start offsets).
 * Dismissed suggestions are excluded; accepted changes are already in currentText.
 */
export function deriveProposedText(
  currentText: string,
  suggestions: ActiveSuggestion[]
): string {
  // Only apply pending suggestions
  const pending = suggestions.filter((s) => s.state === 'pending');

  // Sort descending by start offset (right to left)
  const sorted = [...pending].sort((a, b) => b.activeRange.start - a.activeRange.start);

  let result = currentText;

  for (const s of sorted) {
    const { start, end } = s.activeRange;
    const { original, replacement } = s.edit;

    // Verify slice matches expected original before applying
    if (result.slice(start, end) === original) {
      result = result.slice(0, start) + replacement + result.slice(end);
    }
  }

  return result;
}

/**
 * Basic word-level diff algorithm for side-by-side / inline comparison.
 * Splits text into words and delimiters, finding differences.
 */
export function computeWordDiff(textA: string, textB: string): DiffPart[] {
  if (textA === textB) {
    return textA ? [{ type: 'equal', value: textA }] : [];
  }

  // Tokenize preserving spaces
  const tokenize = (text: string) => text.split(/(\s+|[.,!?;:()]+)/).filter(Boolean);
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  // Compute Longest Common Subsequence (LCS) matrix
  const m = tokensA.length;
  const n = tokensB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (tokensA[i] === tokensB[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to build diff
  const diff: DiffPart[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokensA[i - 1] === tokensB[j - 1]) {
      diff.unshift({ type: 'equal', value: tokensA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'insert', value: tokensB[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: 'delete', value: tokensA[i - 1] });
      i--;
    }
  }

  // Consolidate adjacent diff tokens of the same type
  const consolidated: DiffPart[] = [];
  for (const part of diff) {
    const last = consolidated[consolidated.length - 1];
    if (last && last.type === part.type) {
      last.value += part.value;
    } else {
      consolidated.push({ ...part });
    }
  }

  return consolidated;
}
