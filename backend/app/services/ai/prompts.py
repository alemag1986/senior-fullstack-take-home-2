import json
import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple
from backend.app.models.enums import FeedbackCategory, SuggestionKind
from backend.app.models.schemas import SuggestionCreateInput
from backend.app.models.taxonomy import CONTROLLED_TAXONOMY, is_valid_category_and_rule
from backend.app.services.utf16 import find_utf16_substring

logger = logging.getLogger(__name__)

DEFAULT_RULE_PER_CATEGORY: Dict[FeedbackCategory, str] = {
    FeedbackCategory.GRAMMAR_SYNTAX: "grammar.word_order",
    FeedbackCategory.VOCABULARY_PHRASING: "vocabulary.word_choice",
    FeedbackCategory.SPELLING_ACCENTS: "spelling.misspelling",
}


def clean_llm_json_response(raw_text: str) -> str:
    """
    Defensively strips markdown code fencing (```json ... ```) and leading/trailing whitespace.
    """
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def build_analysis_prompts(
    source_text: str, target_language: str, explanation_language: str = "en"
) -> Tuple[str, str]:
    """
    Builds (system_prompt, user_prompt) tailored for structured language tutoring.
    """
    system_prompt = f"""You are an expert language teacher reviewing a student's journal entry in {target_language}.
Identify mistakes or phrasing improvements and provide explanations in {explanation_language}.

Return ONLY a valid JSON object matching this schema:
{{
  "suggestions": [
    {{
      "category": "grammar_syntax" | "vocabulary_phrasing" | "spelling_accents",
      "rule_code": "one of the allowed rule codes",
      "kind": "correction" | "improvement",
      "original_text": "exact substring from student text to be modified",
      "replacement_text": "suggested replacement text",
      "explanation_title": "Short descriptive title",
      "explanation_message": "Clear explanation of the error or suggestion"
    }}
  ]
}}

Controlled Taxonomy and Allowed rule_code values:
1. grammar_syntax:
   - "grammar.verb_tense"
   - "grammar.subject_verb_agreement"
   - "grammar.word_order"
2. vocabulary_phrasing:
   - "vocabulary.word_choice"
   - "vocabulary.collocation"
   - "vocabulary.idiom"
3. spelling_accents:
   - "spelling.misspelling"
   - "spelling.missing_accent"
   - "spelling.capitalization"

Important Constraints:
- "original_text" MUST be an exact verbatim substring from the student text.
- "replacement_text" MUST differ from "original_text".
- Do not overlap suggestion ranges.
- If there are no mistakes, return {{"suggestions": []}}.
- Do not output markdown, preambles, or conversational commentary. Output JSON only.
"""

    user_prompt = f"Student Journal Text:\n{source_text}"
    return system_prompt, user_prompt


def parse_llm_suggestions(
    raw_content: str, source_text: str, provider_prefix: str = "ai"
) -> List[SuggestionCreateInput]:
    """
    Parses LLM response content into validated SuggestionCreateInput items.
    Handles:
    - Root array [...] or root dict {"suggestions": [...]} / {"mistakes": [...]}
    - Markdown code block fences
    - Category & rule code normalization against controlled taxonomy
    - UTF-16 offset resolution via find_utf16_substring
    """
    if not raw_content or not raw_content.strip():
        return []

    cleaned_json = clean_llm_json_response(raw_content)
    try:
        parsed: Any = json.loads(cleaned_json)
    except Exception as exc:
        logger.warning("Failed to parse LLM JSON: %s. Content: %.120s", exc, raw_content)
        return []

    items: List[Dict[str, Any]] = []
    if isinstance(parsed, list):
        items = parsed
    elif isinstance(parsed, dict):
        for key in ("suggestions", "mistakes", "corrections", "items", "data"):
            val = parsed.get(key)
            if isinstance(val, list):
                items = val
                break
        if not items and "original_text" in parsed:
            # Single item object returned instead of list
            items = [parsed]

    results: List[SuggestionCreateInput] = []
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            continue

        orig = (
            item.get("original_text")
            or item.get("originalText")
            or item.get("original")
            or ""
        )
        if not orig or not isinstance(orig, str):
            continue

        offsets = find_utf16_substring(source_text, orig)
        if not offsets:
            continue
        u16_start, u16_end = offsets

        # Category resolution
        cat_str = str(
            item.get("category")
            or item.get("category_name")
            or "grammar_syntax"
        ).lower()
        if "grammar" in cat_str or "syntax" in cat_str:
            category = FeedbackCategory.GRAMMAR_SYNTAX
        elif "vocab" in cat_str or "phras" in cat_str or "word" in cat_str:
            category = FeedbackCategory.VOCABULARY_PHRASING
        elif "spell" in cat_str or "accent" in cat_str or "ortho" in cat_str:
            category = FeedbackCategory.SPELLING_ACCENTS
        else:
            try:
                category = FeedbackCategory(cat_str)
            except ValueError:
                category = FeedbackCategory.GRAMMAR_SYNTAX

        # Rule code validation & fallback
        rule_code = str(item.get("rule_code") or item.get("ruleCode") or "").strip()
        if not is_valid_category_and_rule(category, rule_code):
            rule_code = DEFAULT_RULE_PER_CATEGORY[category]

        # Kind resolution
        kind_str = str(item.get("kind") or "correction").lower()
        if "improv" in kind_str:
            kind = SuggestionKind.IMPROVEMENT
        else:
            kind = SuggestionKind.CORRECTION

        replacement = (
            item.get("replacement_text")
            or item.get("replacementText")
            or item.get("replacement")
            or ""
        )
        title = (
            item.get("explanation_title")
            or item.get("explanationTitle")
            or item.get("title")
            or "Suggestion"
        )
        message = (
            item.get("explanation_message")
            or item.get("explanationMessage")
            or item.get("message")
            or item.get("explanation")
            or ""
        )

        results.append(
            SuggestionCreateInput(
                id=f"{provider_prefix}-{idx + 1}-{uuid.uuid4().hex[:6]}",
                category=category,
                kind=kind,
                ruleCode=rule_code,
                startOffset=u16_start,
                endOffset=u16_end,
                originalText=orig,
                replacementText=str(replacement),
                explanationTitle=str(title),
                explanationMessage=str(message),
            )
        )

    return results
