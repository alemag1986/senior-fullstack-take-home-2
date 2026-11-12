import json
import logging
import re
import uuid
from typing import List, Optional
import httpx
from backend.app.core.config import settings
from backend.app.models.enums import FeedbackCategory, SuggestionKind
from backend.app.models.schemas import SuggestionCreateInput
from backend.app.services.utf16 import find_utf16_substring

logger = logging.getLogger(__name__)


# Defensive JSON fence stripping
def clean_llm_json_response(raw_text: str) -> str:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def run_heuristic_analyzer(
    source_text: str, target_language: str
) -> List[SuggestionCreateInput]:
    """
    Offline linguistic heuristic engine for language learners.
    Supports Spanish, French, German, Italian, and common phrasing.
    Ensures exact UTF-16 offsets matching source_text slice.
    """
    suggestions: List[SuggestionCreateInput] = []
    lang = (target_language or "es").lower().strip()

    # Rule definitions per language:
    # (pattern_lower, replacement, category, kind, rule_code, title, message)
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

            # Find matching slice
            match_len = len(pattern)
            original_slice = source_text[idx : idx + match_len]

            # Precise UTF-16 offset mapping
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


def call_gemini_api(
    source_text: str, target_language: str, explanation_language: str
) -> Optional[List[SuggestionCreateInput]]:
    """Calls Gemini API with strict structured schema and timeout."""
    if not settings.GEMINI_API_KEY:
        return None

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
    )

    prompt = f"""You are an expert language teacher reviewing a student's journal entry in {target_language}.
Find mistakes or phrasing improvements. Provide explanations in {explanation_language}.

Return ONLY a valid JSON array of objects with this schema:
[
  {{
    "category": "grammar_syntax" | "vocabulary_phrasing" | "spelling_accents",
    "rule_code": "e.g. grammar.verb_tense",
    "kind": "correction" | "improvement",
    "original_text": "exact substring from student text",
    "replacement_text": "suggested replacement",
    "explanation_title": "Short title",
    "explanation_message": "Friendly explanation"
  }}
]

Student Text:
{source_text}
"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code != 200:
                logger.warning("Gemini API error %d: %s", resp.status_code, resp.text)
                return None

            data = resp.json()
            raw_content = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
            cleaned_json = clean_llm_json_response(raw_content)
            parsed = json.loads(cleaned_json)
            if not isinstance(parsed, list):
                return None

            results: List[SuggestionCreateInput] = []
            for idx, item in enumerate(parsed):
                orig = item.get("original_text", "")
                if not orig:
                    continue

                offsets = find_utf16_substring(source_text, orig)
                if not offsets:
                    continue

                u16_start, u16_end = offsets
                cat_str = item.get("category", "grammar_syntax")
                try:
                    category = FeedbackCategory(cat_str)
                except ValueError:
                    category = FeedbackCategory.GRAMMAR_SYNTAX

                kind_str = item.get("kind", "correction")
                try:
                    kind = SuggestionKind(kind_str)
                except ValueError:
                    kind = SuggestionKind.CORRECTION

                results.append(
                    SuggestionCreateInput(
                        id=f"gemini-{idx + 1}",
                        category=category,
                        kind=kind,
                        ruleCode=item.get("rule_code", "general.review"),
                        startOffset=u16_start,
                        endOffset=u16_end,
                        originalText=orig,
                        replacementText=item.get("replacement_text", ""),
                        explanationTitle=item.get("explanation_title", "Suggestion"),
                        explanationMessage=item.get("explanation_message", ""),
                    )
                )
            return results
    except Exception as exc:
        logger.warning("Gemini API exception: %s. Falling back to heuristic.", exc)
        return None


def analyze_journal_text(
    source_text: str, target_language: str, explanation_language: str = "en"
) -> List[SuggestionCreateInput]:
    """Orchestrates AI analysis with Gemini and offline fallback."""
    if settings.GEMINI_API_KEY:
        gemini_result = call_gemini_api(
            source_text, target_language, explanation_language
        )
        if gemini_result is not None:
            return gemini_result

    # Offline / Heuristic mode
    return run_heuristic_analyzer(source_text, target_language)
