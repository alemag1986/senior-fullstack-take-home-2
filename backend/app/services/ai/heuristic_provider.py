import logging
import uuid
from typing import List, Optional
from backend.app.models.enums import FeedbackCategory, SuggestionKind
from backend.app.models.schemas import SuggestionCreateInput
from backend.app.services.ai.base import AIProvider
from backend.app.services.utf16 import find_utf16_substring

logger = logging.getLogger(__name__)


def run_heuristic_analyzer(
    source_text: str, target_language: str
) -> List[SuggestionCreateInput]:
    """
    Offline linguistic heuristic engine for language learners.
    Supports Spanish, French, German, and common phrasing.
    Ensures exact UTF-16 offsets matching source_text slice.
    """
    suggestions: List[SuggestionCreateInput] = []
    lang = (target_language or "es").lower().strip()

    rules = []

    if lang in ("es", "spanish", "español"):
        rules.extend(
            [
                (
                    "esta manana",
                    "esta mañana",
                    FeedbackCategory.SPELLING_ACCENTS,
                    SuggestionKind.CORRECTION,
                    "spelling.misspelling",
                    "Letra 'ñ'",
                    "En español se escribe 'mañana' con la letra eñe (ñ).",
                ),
                (
                    "tambien",
                    "también",
                    FeedbackCategory.SPELLING_ACCENTS,
                    SuggestionKind.CORRECTION,
                    "spelling.missing_accent",
                    "Acentuación aguda",
                    "'También' es una palabra aguda terminada en 'n', por lo que lleva tilde.",
                ),
                (
                    "despues",
                    "después",
                    FeedbackCategory.SPELLING_ACCENTS,
                    SuggestionKind.CORRECTION,
                    "spelling.missing_accent",
                    "Acentuación aguda",
                    "'Después' es palabra aguda terminada en 's', requiere tilde.",
                ),
                (
                    "facil",
                    "fácil",
                    FeedbackCategory.SPELLING_ACCENTS,
                    SuggestionKind.CORRECTION,
                    "spelling.missing_accent",
                    "Acentuación llana",
                    "'Fácil' es palabra llana terminada en consonante distinta de 'n' o 's', lleva tilde.",
                ),
                (
                    "ingles",
                    "inglés",
                    FeedbackCategory.SPELLING_ACCENTS,
                    SuggestionKind.CORRECTION,
                    "spelling.missing_accent",
                    "Acentuación aguda",
                    "'Inglés' lleva tilde en la 'e' final.",
                ),
                (
                    "yo comer",
                    "yo comí",
                    FeedbackCategory.GRAMMAR_SYNTAX,
                    SuggestionKind.CORRECTION,
                    "grammar.verb_tense",
                    "Conjugación verbal",
                    "En lugar del infinitivo, conjuga el verbo (ej. 'comí' en pretérito o 'como' en presente).",
                ),
                (
                    "mucho caliente",
                    "muy caliente",
                    FeedbackCategory.GRAMMAR_SYNTAX,
                    SuggestionKind.CORRECTION,
                    "grammar.word_order",
                    "Uso de 'muy' vs 'mucho'",
                    "Usa 'muy' antes de adjetivos ('muy caliente') y 'mucho' con sustantivos.",
                ),
                (
                    "en el sabado",
                    "el sábado",
                    FeedbackCategory.VOCABULARY_PHRASING,
                    SuggestionKind.IMPROVEMENT,
                    "vocabulary.word_choice",
                    "Días de la semana",
                    "En español no se usa 'en' para días de la semana, di 'el sábado'.",
                ),
                (
                    "los personas",
                    "las personas",
                    FeedbackCategory.GRAMMAR_SYNTAX,
                    SuggestionKind.CORRECTION,
                    "grammar.subject_verb_agreement",
                    "Concordancia de género",
                    "'Persona' es femenino, por tanto el artículo debe ser 'las personas'.",
                ),
            ]
        )
    elif lang in ("fr", "french", "français"):
        rules.extend(
            [
                (
                    "je aime",
                    "j'aime",
                    FeedbackCategory.GRAMMAR_SYNTAX,
                    SuggestionKind.CORRECTION,
                    "grammar.word_order",
                    "Élision obligatoire",
                    "Devant une voyelle, 'je' devient 'j''.",
                ),
                (
                    "apres",
                    "après",
                    FeedbackCategory.SPELLING_ACCENTS,
                    SuggestionKind.CORRECTION,
                    "spelling.missing_accent",
                    "Accent grave",
                    "'Après' prend un accent grave sur le 'e'.",
                ),
                (
                    "tres",
                    "très",
                    FeedbackCategory.SPELLING_ACCENTS,
                    SuggestionKind.CORRECTION,
                    "spelling.missing_accent",
                    "Accent grave",
                    "'Très' s'écrit avec un accent grave.",
                ),
            ]
        )
    elif lang in ("de", "german", "deutsch"):
        rules.extend(
            [
                (
                    "in die schule",
                    "in die Schule",
                    FeedbackCategory.SPELLING_ACCENTS,
                    SuggestionKind.CORRECTION,
                    "spelling.capitalization",
                    "Substantive großschreiben",
                    "Im Deutschen werden alle Nomen großgeschrieben ('Schule').",
                ),
            ]
        )

    # General rules (repeated words)
    repeated_words = ["the the", "de de", "la la", "el el", "que que"]
    for rw in repeated_words:
        single = rw.split()[0]
        rules.append(
            (
                rw,
                single,
                FeedbackCategory.GRAMMAR_SYNTAX,
                SuggestionKind.CORRECTION,
                "grammar.word_order",
                "Palabra repetida",
                f"La palabra '{single}' está repetida accidentalmente.",
            )
        )

    lower_source = source_text.lower()
    for pattern, replacement, cat, kind, rule_code, title, msg in rules:
        start_search = 0
        while start_search < len(lower_source):
            idx = lower_source.find(pattern, start_search)
            if idx == -1:
                break

            match_len = len(pattern)
            original_slice = source_text[idx : idx + match_len]

            offsets = find_utf16_substring(source_text, original_slice, start_char=idx)
            if offsets:
                u16_start, u16_end = offsets
                suggestions.append(
                    SuggestionCreateInput(
                        id=f"sug-{uuid.uuid4().hex[:12]}",
                        category=cat,
                        kind=kind,
                        ruleCode=rule_code,
                        startOffset=u16_start,
                        endOffset=u16_end,
                        originalText=original_slice,
                        replacementText=replacement,
                        explanationTitle=title,
                        explanationMessage=msg,
                    )
                )

            start_search = idx + match_len

    return suggestions


class HeuristicProvider(AIProvider):
    """
    Offline linguistic heuristic engine implementing AIProvider.
    Ensures tests and local development run reliably without network or API keys.
    """

    @property
    def provider_name(self) -> str:
        return "heuristic"

    @property
    def model_version(self) -> str:
        return "heuristic-v1"

    def analyze(
        self,
        source_text: str,
        target_language: str,
        explanation_language: str = "en",
    ) -> Optional[List[SuggestionCreateInput]]:
        return run_heuristic_analyzer(source_text, target_language)
