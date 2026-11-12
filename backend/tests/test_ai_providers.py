import json
from unittest.mock import MagicMock
import httpx
import pytest
from backend.app.core.config import settings
from backend.app.models.enums import FeedbackCategory, SuggestionKind
from backend.app.services.ai import (
    AIProvider,
    FallbackAIProvider,
    GeminiProvider,
    HeuristicProvider,
    OpenRouterProvider,
    get_ai_provider,
    register_provider,
    reset_provider_registry,
)
from backend.app.services.ai.prompts import (
    clean_llm_json_response,
    parse_llm_suggestions,
)
from backend.app.services.ai_service import analyze_journal_text, get_active_model_version


class MockTransport(httpx.BaseTransport):
    def __init__(self, handler):
        self.handler = handler

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        return self.handler(request)


@pytest.fixture(autouse=True)
def clean_registry():
    yield
    reset_provider_registry()


def test_openrouter_provider_missing_key_returns_none():
    provider = OpenRouterProvider(api_key=None)
    result = provider.analyze("Hola mundo", "es")
    assert result is None


def test_openrouter_provider_successful_request():
    captured_request = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured_request["url"] = str(request.url)
        captured_request["headers"] = dict(request.headers)
        captured_request["body"] = json.loads(request.content.decode("utf-8"))

        mock_content = json.dumps(
            {
                "suggestions": [
                    {
                        "category": "grammar_syntax",
                        "rule_code": "grammar.verb_tense",
                        "kind": "correction",
                        "original_text": "yo comer",
                        "replacement_text": "yo comí",
                        "explanation_title": "Conjugación",
                        "explanation_message": "Verbo no conjugado",
                    }
                ]
            }
        )
        resp_data = {
            "id": "gen-12345",
            "choices": [{"message": {"role": "assistant", "content": mock_content}}],
        }
        return httpx.Response(200, json=resp_data)

    mock_client = httpx.Client(transport=MockTransport(handler))
    provider = OpenRouterProvider(
        api_key="test-sk-or-123",
        model="google/gemini-2.0-flash-001",
        base_url="https://openrouter.ai/api/v1",
        site_url="http://testsite.com",
        app_name="Test App",
        http_client=mock_client,
    )

    text = "Ayer yo comer una manzana."
    result = provider.analyze(text, "es", "en")

    assert result is not None
    assert len(result) == 1
    sug = result[0]
    assert sug.originalText == "yo comer"
    assert sug.replacementText == "yo comí"
    assert sug.category == FeedbackCategory.GRAMMAR_SYNTAX
    assert sug.kind == SuggestionKind.CORRECTION
    assert sug.startOffset == 5
    assert sug.endOffset == 13

    # Verify request payload & headers
    assert captured_request["url"] == "https://openrouter.ai/api/v1/chat/completions"
    assert captured_request["headers"]["authorization"] == "Bearer test-sk-or-123"
    assert captured_request["headers"]["http-referer"] == "http://testsite.com"
    assert captured_request["headers"]["x-title"] == "Test App"
    assert captured_request["body"]["model"] == "google/gemini-2.0-flash-001"
    assert captured_request["body"]["response_format"] == {"type": "json_object"}


def test_openrouter_provider_markdown_fenced_response():
    def handler(request: httpx.Request) -> httpx.Response:
        # LLM returns markdown ```json block
        mock_content = """```json
[
  {
    "category": "spelling_accents",
    "rule_code": "spelling.missing_accent",
    "kind": "correction",
    "original_text": "facil",
    "replacement_text": "fácil",
    "explanation_title": "Acento",
    "explanation_message": "Lleva tilde"
  }
]
```"""
        resp_data = {
            "choices": [{"message": {"role": "assistant", "content": mock_content}}]
        }
        return httpx.Response(200, json=resp_data)

    mock_client = httpx.Client(transport=MockTransport(handler))
    provider = OpenRouterProvider(api_key="test-key", http_client=mock_client)

    result = provider.analyze("El examen fue facil.", "es")
    assert result is not None
    assert len(result) == 1
    assert result[0].originalText == "facil"
    assert result[0].replacementText == "fácil"
    assert result[0].category == FeedbackCategory.SPELLING_ACCENTS


def test_openrouter_provider_http_error_graceful_handling():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Internal Server Error")

    mock_client = httpx.Client(transport=MockTransport(handler))
    provider = OpenRouterProvider(api_key="test-key", http_client=mock_client)

    result = provider.analyze("Hola mundo", "es")
    assert result is None


def test_openrouter_provider_timeout_graceful_handling():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("Read timeout")

    mock_client = httpx.Client(transport=MockTransport(handler))
    provider = OpenRouterProvider(api_key="test-key", http_client=mock_client)

    result = provider.analyze("Hola mundo", "es")
    assert result is None


def test_swappable_provider_configuration(monkeypatch):
    # 1. Test OpenRouter as default or configured
    monkeypatch.setattr(settings, "AI_PROVIDER", "openrouter")
    p_or = get_ai_provider()
    assert isinstance(p_or, FallbackAIProvider)
    assert p_or.provider_name == "openrouter"
    assert "openrouter/" in p_or.model_version

    # 2. Test Gemini swap via configuration
    monkeypatch.setattr(settings, "AI_PROVIDER", "gemini")
    p_gemini = get_ai_provider()
    assert isinstance(p_gemini, FallbackAIProvider)
    assert p_gemini.provider_name == "gemini"
    assert "gemini/" in p_gemini.model_version

    # 3. Test Heuristic / Mock swap via configuration
    monkeypatch.setattr(settings, "AI_PROVIDER", "heuristic")
    p_heu = get_ai_provider()
    assert isinstance(p_heu, HeuristicProvider)
    assert p_heu.provider_name == "heuristic"
    assert p_heu.model_version == "heuristic-v1"

    # 4. Unknown provider safely defaults to heuristic
    monkeypatch.setattr(settings, "AI_PROVIDER", "unknown_provider_xyz")
    p_unknown = get_ai_provider()
    assert isinstance(p_unknown, HeuristicProvider)


def test_custom_provider_registration():
    class CustomLocalProvider(AIProvider):
        @property
        def provider_name(self) -> str:
            return "custom_local"

        @property
        def model_version(self) -> str:
            return "custom-v1"

        def analyze(self, source_text: str, target_language: str, explanation_language: str = "en"):
            return []

    register_provider("custom_local", lambda: CustomLocalProvider())

    p = get_ai_provider("custom_local", with_fallback=False)
    assert isinstance(p, CustomLocalProvider)
    assert p.provider_name == "custom_local"
    assert p.model_version == "custom-v1"


def test_fallback_when_openrouter_key_is_missing(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "openrouter")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", None)

    # When OpenRouter key is not set, FallbackAIProvider engages HeuristicProvider
    provider = get_ai_provider()
    text = "Hola, yo comer mucho caliente esta manana."
    results = provider.analyze(text, "es")

    assert results is not None
    assert len(results) >= 2  # Offline heuristic catches 'yo comer' and 'esta manana'


def test_analyze_api_endpoint_with_openrouter(client, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        mock_content = json.dumps(
            {
                "suggestions": [
                    {
                        "category": "grammar_syntax",
                        "rule_code": "grammar.verb_tense",
                        "kind": "correction",
                        "original_text": "yo vivir",
                        "replacement_text": "yo vivo",
                        "explanation_title": "Conjugación en presente",
                        "explanation_message": "En presente de indicativo: yo vivo.",
                    }
                ]
            }
        )
        resp_data = {
            "choices": [{"message": {"role": "assistant", "content": mock_content}}]
        }
        return httpx.Response(200, json=resp_data)

    mock_client = httpx.Client(transport=MockTransport(handler))
    custom_or = OpenRouterProvider(
        api_key="sk-or-real-mock",
        model="google/gemini-2.0-flash-001",
        http_client=mock_client,
    )

    # Register this provider instance for openrouter
    register_provider("openrouter", lambda: custom_or)
    monkeypatch.setattr(settings, "AI_PROVIDER", "openrouter")

    headers = {"X-Session-ID": "user-or-test"}
    content = "Hola, yo vivir en Madrid."
    res = client.post(
        "/api/entries/analyze",
        json={
            "content": content,
            "targetLanguage": "es",
            "title": "Madrid",
        },
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "completed"
    assert data["modelVersion"] == "openrouter/google/gemini-2.0-flash-001"
    assert len(data["suggestions"]) == 1
    assert data["suggestions"][0]["edit"]["original"] == "yo vivir"
    assert data["suggestions"][0]["edit"]["replacement"] == "yo vivo"

