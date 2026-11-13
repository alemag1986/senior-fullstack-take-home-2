from abc import ABC, abstractmethod
from typing import List, Optional
from backend.app.models.schemas import SuggestionCreateInput


class AIProvider(ABC):
    """
    Abstract interface for AI language analysis providers.

    Implementations can integrate with OpenRouter, Gemini, Anthropic,
    local models (Ollama/vLLM), or offline rule engines.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Identifier for this provider implementation (e.g., 'openrouter', 'gemini')."""
        pass

    @property
    @abstractmethod
    def model_version(self) -> str:
        """The specific model name/version used for analysis tracking."""
        pass

    @abstractmethod
    def analyze(
        self,
        source_text: str,
        target_language: str,
        explanation_language: str = "en",
    ) -> Optional[List[SuggestionCreateInput]]:
        """
        Analyze foreign language journal text and generate candidate suggestions.

        Returns:
            A list of SuggestionCreateInput candidates, or None if the provider
            is unavailable, unconfigured, or encounters an unrecoverable failure.
        """
        pass
