from typing import Dict, Set
from backend.app.models.enums import FeedbackCategory

TAXONOMY_VERSION = "1.0.0"

# Category -> Allowed Rule Codes mapping
CONTROLLED_TAXONOMY: Dict[FeedbackCategory, Set[str]] = {
    FeedbackCategory.GRAMMAR_SYNTAX: {
        "grammar.verb_tense",
        "grammar.subject_verb_agreement",
        "grammar.word_order",
    },
    FeedbackCategory.VOCABULARY_PHRASING: {
        "vocabulary.word_choice",
        "vocabulary.collocation",
        "vocabulary.idiom",
    },
    FeedbackCategory.SPELLING_ACCENTS: {
        "spelling.misspelling",
        "spelling.missing_accent",
        "spelling.capitalization",
    },
}

ALL_ALLOWED_RULE_CODES: Set[str] = {
    code for codes in CONTROLLED_TAXONOMY.values() for code in codes
}


def is_valid_category_and_rule(category: FeedbackCategory, rule_code: str) -> bool:
    """Verifies that the category is recognized and rule_code is permitted under it."""
    allowed_rules = CONTROLLED_TAXONOMY.get(category)
    if not allowed_rules:
        return False
    return rule_code in allowed_rules
