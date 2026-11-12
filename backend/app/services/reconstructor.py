from typing import List, Protocol
from backend.app.services.utf16 import utf16_len, utf16_slice


class SuggestionEditItem(Protocol):
    start_offset: int
    end_offset: int
    original_text: str
    replacement_text: str


def apply_suggestions_right_to_left(
    source_text: str, suggestions: List[SuggestionEditItem]
) -> str:
    """
    Rebuilds text from sourceText by applying suggestions from right to left
    (descending by start_offset). Since edits do not overlap, descending order ensures
    unaffected earlier offsets remain valid without shifting.
    """
    if not suggestions:
        return source_text

    # Sort descending by start_offset, then end_offset
    sorted_suggestions = sorted(
        suggestions, key=lambda s: (s.start_offset, s.end_offset), reverse=True
    )

    current_text = source_text
    for s in sorted_suggestions:
        curr_len = utf16_len(current_text)
        prefix = utf16_slice(current_text, 0, s.start_offset)
        suffix = utf16_slice(current_text, s.end_offset, curr_len)
        current_text = prefix + s.replacement_text + suffix

    return current_text
