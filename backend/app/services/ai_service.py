import logging
from typing import List, Optional
from backend.app.models.schemas import SuggestionCreateInput
from backend.app.services.ai.base import AIProvider
from backend.app.services.ai.factory import get_ai_provider
from backend.app.services.ai.gemini_provider import GeminiProvider
from backend.app.services.ai.heuristic_provider import run_heuristic_analyzer
from backend.app.services.ai.openrouter_provider import OpenRouterProvider
from backend.app.services.ai.prompts import (
    clean_llm_json_response,
    parse_llm_suggestions,
)

logger = logging.getLogger(__name__)


def call_openrouter_api(
    source_text: str, target_language: str, explanation_language: str = "en"
) -> Optional[List[SuggestionCreateInput]]:
    """Helper for direct OpenRouter invocation."""
    provider = OpenRouterProvider()
    return provider.analyze(source_text, target_language, explanation_language)


def call_gemini_api(
    source_text: str, target_language: str, explanation_language: str = "en"
) -> Optional[List[SuggestionCreateInput]]:
    """Helper for direct Gemini invocation."""
    provider = GeminiProvider()
    return provider.analyze(source_text, target_language, explanation_language)


def get_active_model_version(provider: Optional[AIProvider] = None) -> str:
    """Returns the model version identifier for the active provider."""
    p = provider or get_ai_provider()
    return p.model_version


def analyze_journal_text(
    source_text: str,
    target_language: str,
    explanation_language: str = "en",
    provider: Optional[AIProvider] = None,
) -> List[SuggestionCreateInput]:
    """
    Orchestrates AI analysis using the configured provider (defaults to OpenRouter),
    with automatic fallback to offline heuristics when unconfigured or on failure.
    """
    active_provider = provider or get_ai_provider()
    results = active_provider.analyze(
        source_text, target_language, explanation_language
    )
    if results is not None:
        return results

    # Final safeguard offline heuristic
    return run_heuristic_analyzer(source_text, target_language)
