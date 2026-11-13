from backend.app.models.enums import FeedbackCategory
from backend.app.models.taxonomy import is_valid_category_and_rule


def test_taxonomy_valid_pairs():
    assert is_valid_category_and_rule(
        FeedbackCategory.GRAMMAR_SYNTAX, "grammar.verb_tense"
    )
    assert is_valid_category_and_rule(
        FeedbackCategory.VOCABULARY_PHRASING, "vocabulary.word_choice"
    )
    assert is_valid_category_and_rule(
        FeedbackCategory.SPELLING_ACCENTS, "spelling.missing_accent"
    )


def test_taxonomy_invalid_pairs():
    # Cross-category mismatches
    assert not is_valid_category_and_rule(
        FeedbackCategory.GRAMMAR_SYNTAX, "spelling.missing_accent"
    )
    # Arbitrary / unapproved codes
    assert not is_valid_category_and_rule(
        FeedbackCategory.GRAMMAR_SYNTAX, "grammar.custom_rule"
    )
    assert not is_valid_category_and_rule(
        FeedbackCategory.VOCABULARY_PHRASING, "unknown.code"
    )
