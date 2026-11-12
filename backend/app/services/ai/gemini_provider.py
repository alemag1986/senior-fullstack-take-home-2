import json
import logging
from typing import List, Optional
import httpx
from backend.app.core.config import settings
from backend.app.models.schemas import SuggestionCreateInput
from backend.app.services.ai.base import AIProvider
from backend.app.services.ai.prompts import (
    build_analysis_prompts,
    parse_llm_suggestions,
)

logger = logging.getLogger(__name__)


class GeminiProvider(AIProvider):
    """
    Google Gemini implementation of AIProvider.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        http_client: Optional[httpx.Client] = None,
    ):
        self.api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL
        self._http_client = http_client

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_version(self) -> str:
        return f"gemini/{self.model}"

    def analyze(
        self,
        source_text: str,
        target_language: str,
        explanation_language: str = "en",
    ) -> Optional[List[SuggestionCreateInput]]:
        if not self.api_key:
            logger.warning("Gemini API key is not configured. Falling back.")
            return None

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )

        system_prompt, user_prompt = build_analysis_prompts(
            source_text, target_language, explanation_language
        )
        combined_prompt = f"{system_prompt}\n\n{user_prompt}"

        payload = {
            "contents": [{"parts": [{"text": combined_prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }

        try:
            if self._http_client:
                resp = self._http_client.post(url, json=payload)
                return self._handle_response(resp, source_text)
            else:
                with httpx.Client(timeout=15.0) as client:
                    resp = client.post(url, json=payload)
                    return self._handle_response(resp, source_text)
        except Exception as exc:
            logger.warning("Gemini API exception: %s", exc)
            return None

    def _handle_response(
        self, resp: httpx.Response, source_text: str
    ) -> Optional[List[SuggestionCreateInput]]:
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
        return parse_llm_suggestions(
            raw_content, source_text, provider_prefix="gemini"
        )
