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


class OpenRouterProvider(AIProvider):
    """
    OpenRouter implementation of AIProvider.

    Connects to OpenRouter's OpenAI-compatible completions API with
    customizable model, site referrer, app name, and timeout settings.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        site_url: Optional[str] = None,
        app_name: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        http_client: Optional[httpx.Client] = None,
    ):
        self.api_key = api_key if api_key is not None else settings.OPENROUTER_API_KEY
        self.model = model or settings.OPENROUTER_MODEL
        self.base_url = (base_url or settings.OPENROUTER_BASE_URL).rstrip("/")
        self.site_url = site_url if site_url is not None else settings.OPENROUTER_SITE_URL
        self.app_name = app_name if app_name is not None else settings.OPENROUTER_APP_NAME
        self.timeout_seconds = (
            timeout_seconds
            if timeout_seconds is not None
            else settings.OPENROUTER_TIMEOUT_SECONDS
        )
        self._http_client = http_client

    @property
    def provider_name(self) -> str:
        return "openrouter"

    @property
    def model_version(self) -> str:
        return f"openrouter/{self.model}"

    def analyze(
        self,
        source_text: str,
        target_language: str,
        explanation_language: str = "en",
    ) -> Optional[List[SuggestionCreateInput]]:
        if not self.api_key:
            logger.warning(
                "OpenRouter API key is not configured. Falling back."
            )
            return None

        url = f"{self.base_url}/chat/completions"
        system_prompt, user_prompt = build_analysis_prompts(
            source_text, target_language, explanation_language
        )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.site_url:
            headers["HTTP-Referer"] = self.site_url
        if self.app_name:
            headers["X-Title"] = self.app_name

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }

        try:
            if self._http_client:
                resp = self._http_client.post(url, json=payload, headers=headers)
                return self._handle_response(resp, source_text)
            else:
                with httpx.Client(timeout=self.timeout_seconds) as client:
                    resp = client.post(url, json=payload, headers=headers)
                    return self._handle_response(resp, source_text)
        except httpx.TimeoutException as exc:
            logger.warning("OpenRouter request timed out after %.1fs: %s", self.timeout_seconds, exc)
            return None
        except Exception as exc:
            logger.warning("OpenRouter request failed: %s", exc)
            return None

    def _handle_response(
        self, resp: httpx.Response, source_text: str
    ) -> Optional[List[SuggestionCreateInput]]:
        if resp.status_code != 200:
            logger.warning(
                "OpenRouter API returned HTTP %d: %.300s",
                resp.status_code,
                resp.text,
            )
            return None

        try:
            data = resp.json()
        except Exception as exc:
            logger.warning("OpenRouter response was not valid JSON: %s", exc)
            return None

        choices = data.get("choices", [])
        if not choices:
            logger.warning("OpenRouter response contains no choices.")
            return []

        message = choices[0].get("message", {})
        raw_content = message.get("content", "")

        # Handle content parts array if present
        if isinstance(raw_content, list):
            raw_content = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in raw_content
            )

        return parse_llm_suggestions(
            raw_content, source_text, provider_prefix="openrouter"
        )
