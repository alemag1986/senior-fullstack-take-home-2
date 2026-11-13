import logging
from typing import List, Optional, Tuple
from backend.app.models.enums import FeedbackCategory, SuggestionKind
from backend.app.models.schemas import SuggestionCreateInput
from backend.app.models.taxonomy import is_valid_category_and_rule
from backend.app.services.utf16 import (
    find_all_utf16_occurrences,
    is_valid_surrogate_boundary,
    utf16_len,
    utf16_slice,
)

logger = logging.getLogger(__name__)


class ValidatedSuggestion:
    def __init__(
        self,
        id: Optional[str],
        category: FeedbackCategory,
        rule_code: str,
        kind: SuggestionKind,
        start_offset: int,
        end_offset: int,
        original_text: str,
        replacement_text: str,
        explanation_title: str,
        explanation_message: str,
    ):
        self.id = id
        self.category = category
        self.rule_code = rule_code
        self.kind = kind
        self.start_offset = start_offset
        self.end_offset = end_offset
        self.original_text = original_text
        self.replacement_text = replacement_text
        self.explanation_title = explanation_title
        self.explanation_message = explanation_message


def edits_conflict(
    e1_start: int, e1_end: int, e2_start: int, e2_end: int
) -> bool:
    """
    Checks if two edits conflict:
    - Overlapping ranges (max(s1, s2) < min(e1, e2))
    - Competing insertions at the exact same offset (s1 == e1 == s2 == e2)
    - Insertion on or inside another edit's range:
      if e1 is insertion and e2 is range: e2_start <= e1_start <= e2_end
      if e2 is insertion and e1 is range: e1_start <= e2_start <= e1_end
    """
    is_e1_ins = e1_start == e1_end
    is_e2_ins = e2_start == e2_end

    if is_e1_ins and is_e2_ins:
        return e1_start == e2_start

    if is_e1_ins and not is_e2_ins:
        return e2_start <= e1_start <= e2_end

    if is_e2_ins and not is_e1_ins:
        return e1_start <= e2_start <= e1_end

    # Both are range edits
    return max(e1_start, e2_start) < min(e1_end, e2_end)


def validate_and_filter_suggestions(
    source_text: str, candidates: List[SuggestionCreateInput]
) -> Tuple[List[ValidatedSuggestion], List[str]]:
    """
    Validates candidate suggestions against source text invariants:
    - UTF-16 bounds and surrogate boundary integrity.
    - Category & rule code compatibility against controlled taxonomy.
    - Exact match or unambiguous repair of original text.
    - Replacement / deletion / insertion invariants.
    - Conflict resolution: discards conflicting edits deterministically.

    Returns (validated_suggestions, diagnostic_logs).
    """
    diagnostics: List[str] = []
    text_len = utf16_len(source_text)
    validated_candidates: List[ValidatedSuggestion] = []

    for idx, c in enumerate(candidates):
        cand_id = c.id or f"cand-{idx}"

        # 1. Category and Rule Code check
        if not is_valid_category_and_rule(c.category, c.ruleCode):
            diagnostics.append(
                f"[{cand_id}] Invalid category '{c.category}' or rule_code '{c.ruleCode}'"
            )
            continue

        # 2. Check original != replacement
        if c.originalText == c.replacementText:
            diagnostics.append(f"[{cand_id}] Original text equals replacement text")
            continue

        start = c.startOffset
        end = c.endOffset
        original = c.originalText
        replacement = c.replacementText

        # 3. Check kinds
        is_ins = start == end and original == "" and len(replacement) > 0
        is_del = start < end and len(original) > 0 and replacement == ""
        is_rep = start < end and len(original) > 0 and len(replacement) > 0

        if not (is_ins or is_del or is_rep):
            diagnostics.append(
                f"[{cand_id}] Invalid kind structure: start={start}, end={end}, "
                f"orig_len={len(original)}, repl_len={len(replacement)}"
            )
            continue

        # 4. UTF-16 bounds checking
        if start < 0 or end > text_len or start > end:
            diagnostics.append(
                f"[{cand_id}] Offsets [{start}, {end}] out of bounds (total={text_len})"
            )
            continue

        # 5. Check surrogate boundaries
        if not is_valid_surrogate_boundary(source_text, start):
            diagnostics.append(f"[{cand_id}] Start offset {start} splits surrogate pair")
            continue
        if not is_valid_surrogate_boundary(source_text, end):
            diagnostics.append(f"[{cand_id}] End offset {end} splits surrogate pair")
            continue

        # 6. Check source range matches original or unambiguous repair
        if not is_ins:
            actual_slice = utf16_slice(source_text, start, end)
            if actual_slice != original:
                # Attempt unambiguous offset repair
                matches = find_all_utf16_occurrences(source_text, original)
                if len(matches) == 1:
                    repaired_start, repaired_end = matches[0]
                    diagnostics.append(
                        f"[{cand_id}] Unambiguous repair: [{start}, {end}] -> [{repaired_start}, {repaired_end}]"
                    )
                    start = repaired_start
                    end = repaired_end
                else:
                    diagnostics.append(
                        f"[{cand_id}] Text mismatch: expected '{original}', found '{actual_slice}'. "
                        f"Found {len(matches)} occurrences (ambiguous/none)."
                    )
                    continue

        validated_candidates.append(
            ValidatedSuggestion(
                id=c.id,
                category=c.category,
                rule_code=c.ruleCode,
                kind=c.kind,
                start_offset=start,
                end_offset=end,
                original_text=original,
                replacement_text=replacement,
                explanation_title=c.explanationTitle,
                explanation_message=c.explanationMessage,
            )
        )

    # 7. Conflict resolution: deterministic sort by start_offset ASC, end_offset ASC, id ASC
    validated_candidates.sort(
        key=lambda s: (s.start_offset, s.end_offset, s.id or "")
    )

    accepted_suggestions: List[ValidatedSuggestion] = []
    for cand in validated_candidates:
        conflicts = False
        for acc in accepted_suggestions:
            if edits_conflict(
                cand.start_offset,
                cand.end_offset,
                acc.start_offset,
                acc.end_offset,
            ):
                conflicts = True
                diagnostics.append(
                    f"[{cand.id}] Discarded due to conflict with [{acc.id}] "
                    f"at range [{cand.start_offset}, {cand.end_offset}] vs [{acc.start_offset}, {acc.end_offset}]"
                )
                break
        if not conflicts:
            accepted_suggestions.append(cand)

    return accepted_suggestions, diagnostics
