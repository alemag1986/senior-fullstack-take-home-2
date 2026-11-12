from backend.app.models.enums import FeedbackCategory, SuggestionKind
from backend.app.models.schemas import SuggestionCreateInput
from backend.app.services.validator import (
    edits_conflict,
    validate_and_filter_suggestions,
)


def test_validator_replacement_deletion_insertion():
    text = "Yo comer manzanas ayer."
    # replacement: "comer" -> "comí"
    s1 = SuggestionCreateInput(
        id="s1",
        category=FeedbackCategory.GRAMMAR_SYNTAX,
        ruleCode="grammar.verb_tense",
        kind=SuggestionKind.CORRECTION,
        startOffset=3,
        endOffset=8,
        originalText="comer",
        replacementText="comí",
        explanationTitle="Tiempo verbal",
        explanationMessage="Usa pretérito indefinido.",
    )
    # deletion: delete "ayer." (or delete " ayer")
    s2 = SuggestionCreateInput(
        id="s2",
        category=FeedbackCategory.GRAMMAR_SYNTAX,
        ruleCode="grammar.word_order",
        kind=SuggestionKind.IMPROVEMENT,
        startOffset=17,
        endOffset=22,
        originalText=" ayer",
        replacementText="",
        explanationTitle="Eliminar palabra",
        explanationMessage="Opcional.",
    )

    validated, diag = validate_and_filter_suggestions(text, [s1, s2])
    assert len(validated) == 2
    assert validated[0].id == "s1"
    assert validated[1].id == "s2"


def test_validator_insertion():
    text = "Voy parque."
    # Insertion at index 4 (between "Voy " and "parque.") -> insert "al "
    s_ins = SuggestionCreateInput(
        id="ins-1",
        category=FeedbackCategory.GRAMMAR_SYNTAX,
        ruleCode="grammar.subject_verb_agreement",
        kind=SuggestionKind.CORRECTION,
        startOffset=4,
        endOffset=4,
        originalText="",
        replacementText="al ",
        explanationTitle="Falta preposición",
        explanationMessage="Se dice 'voy al parque'.",
    )
    validated, diag = validate_and_filter_suggestions(text, [s_ins])
    assert len(validated) == 1
    assert validated[0].start_offset == 4
    assert validated[0].end_offset == 4


def test_validator_unambiguous_offset_repair():
    text = "Mi hermano es muy alto y simpatico."
    # Model passed wrong offsets (e.g. [0, 9]) for "simpatico", but "simpatico" appears only once in text
    s_wrong_offset = SuggestionCreateInput(
        id="repair-1",
        category=FeedbackCategory.SPELLING_ACCENTS,
        ruleCode="spelling.missing_accent",
        kind=SuggestionKind.CORRECTION,
        startOffset=0,
        endOffset=9,
        originalText="simpatico",
        replacementText="simpático",
        explanationTitle="Tilde",
        explanationMessage="Lleva tilde.",
    )

    validated, diag = validate_and_filter_suggestions(text, [s_wrong_offset])
    assert len(validated) == 1
    # Repaired to actual offset of "simpatico" (25 to 34)
    assert validated[0].start_offset == 25
    assert validated[0].end_offset == 34


def test_validator_ambiguous_offset_rejected():
    text = "la casa y la mesa"
    # "la" appears twice, model passes wrong offset [5, 7] where slice is "as"
    s_ambiguous = SuggestionCreateInput(
        id="ambig-1",
        category=FeedbackCategory.GRAMMAR_SYNTAX,
        ruleCode="grammar.word_order",
        kind=SuggestionKind.CORRECTION,
        startOffset=5,
        endOffset=7,
        originalText="la",
        replacementText="una",
        explanationTitle="Artículo",
        explanationMessage="Mismo artículo.",
    )
    validated, diag = validate_and_filter_suggestions(text, [s_ambiguous])
    assert len(validated) == 0
    assert any("Found 2 occurrences (ambiguous/none)" in d for d in diag)


def test_validator_conflicting_overlapping_edits():
    text = "Hoy es un buen dia."
    # Edit 1: "buen dia" [10, 18]
    s1 = SuggestionCreateInput(
        id="s1",
        category=FeedbackCategory.VOCABULARY_PHRASING,
        ruleCode="vocabulary.collocation",
        kind=SuggestionKind.IMPROVEMENT,
        startOffset=10,
        endOffset=18,
        originalText="buen dia",
        replacementText="gran día",
        explanationTitle="Expresión",
        explanationMessage="Mejora.",
    )
    # Edit 2: "dia" [15, 18] (overlaps with s1)
    s2 = SuggestionCreateInput(
        id="s2",
        category=FeedbackCategory.SPELLING_ACCENTS,
        ruleCode="spelling.missing_accent",
        kind=SuggestionKind.CORRECTION,
        startOffset=15,
        endOffset=18,
        originalText="dia",
        replacementText="día",
        explanationTitle="Tilde",
        explanationMessage="Lleva tilde.",
    )

    validated, diag = validate_and_filter_suggestions(text, [s1, s2])
    # s1 starts at 10, s2 starts at 15. s1 is kept, s2 is discarded due to overlap
    assert len(validated) == 1
    assert validated[0].id == "s1"
    assert any("Discarded due to conflict" in d for d in diag)


def test_edits_conflict_matrix():
    # Range overlap
    assert edits_conflict(10, 20, 15, 25)
    assert edits_conflict(15, 25, 10, 20)
    assert not edits_conflict(10, 15, 15, 20)  # adjacent, not overlapping

    # Competing insertions at same point
    assert edits_conflict(5, 5, 5, 5)
    assert not edits_conflict(5, 5, 6, 6)

    # Insertion on or inside range
    assert edits_conflict(5, 5, 4, 10)
    assert edits_conflict(4, 10, 5, 5)
    assert edits_conflict(4, 4, 4, 10)  # boundary
    assert edits_conflict(10, 10, 4, 10)  # boundary
    assert not edits_conflict(3, 3, 4, 10)
