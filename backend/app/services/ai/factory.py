import logging
from typing import Callable, Dict, Optional, Type
from backend.app.core.config import settings
from backend.app.services.ai.base import AIProvider
from backend.app.services.ai.gemini_provider import GeminiProvider
from backend.app.services.ai.heuristic_provider import HeuristicProvider
from backend.app.services.ai.openrouter_provider import OpenRouterProvider

logger = logging.getLogger(__name__)

# Registry mapping provider name to provider factory/class
_PROVIDER_REGISTRY: Dict[str, Callable[[], AIProvider]] = {}


def register_provider(name: str, factory: Callable[[], AIProvider]) -> None:
    """Registers an AIProvider factory under a specified name."""
    _PROVIDER_REGISTRY[name.lower().strip()] = factory


def reset_provider_registry() -> None:
    """Resets the provider registry to its default built-in providers."""
    _PROVIDER_REGISTRY.clear()
    register_provider("openrouter", lambda: OpenRouterProvider())
    register_provider("gemini", lambda: GeminiProvider())
    register_provider("heuristic", lambda: HeuristicProvider())
    register_provider("mock", lambda: HeuristicProvider())


# Initial default registration
reset_provider_registry()


class FallbackAIProvider(AIProvider):
    """
    Wraps a primary provider with an automatic fallback (typically HeuristicProvider)
    if the primary provider is unconfigured or encounters an unrecoverable failure.
    """

    def __init__(self, primary: AIProvider, fallback: AIProvider):
        self.primary = primary
        self.fallback = fallback

    @property
    def provider_name(self) -> str:
        return self.primary.provider_name

    @property
    def model_version(self) -> str:
        return self.primary.model_version

    def analyze(
        self,
        source_text: str,
        target_language: str,
        explanation_language: str = "en",
    ):
        result = self.primary.analyze(
            source_text, target_language, explanation_language
        )
        if result is not None:
            return result

        logger.info(
            "Provider '%s' returned no results or failed; engaging fallback '%s'.",
            self.primary.provider_name,
            self.fallback.provider_name,
        )
        return self.fallback.analyze(
            source_text, target_language, explanation_language
        )


def get_ai_provider(
    provider_type: Optional[str] = None,
    with_fallback: bool = True,
) -> AIProvider:
    """
    Factory function returning the configured AIProvider instance.

    Swapping providers is as simple as:
    - Setting the environment variable AI_PROVIDER (e.g. AI_PROVIDER=openrouter, AI_PROVIDER=gemini)
    - Or passing provider_type explicitly (e.g. get_ai_provider("openrouter"))
    """
    selected = (provider_type or settings.AI_PROVIDER).lower().strip()

    factory = _PROVIDER_REGISTRY.get(selected)
    if not factory:
        valid_keys = ", ".join(_PROVIDER_REGISTRY.keys())
        logger.warning(
            "Unknown AI provider '%s'. Valid options are: [%s]. Falling back to heuristic.",
            selected,
            valid_keys,
        )
        return HeuristicProvider()

    provider = factory()

    if with_fallback and selected not in ("heuristic", "mock"):
        return FallbackAIProvider(primary=provider, fallback=HeuristicProvider())

    return provider
