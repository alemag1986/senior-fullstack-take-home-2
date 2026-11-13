from fastapi.testclient import TestClient


def test_analyze_entry_flow_creates_analysis_and_suggestions(client: TestClient):
    headers = {"X-Session-ID": "user-test-ai"}

    # Text with classic Spanish mistakes:
    # "yo comer" -> verb conjugation
    # "esta manana" -> letter eñe
    content = "Hola, yo comer mucho caliente esta manana."
    payload = {
        "content": content,
        "targetLanguage": "es",
        "explanationLanguage": "en",
        "title": "Mi Mañana",
    }

    res = client.post("/api/entries/analyze", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "completed"
    assert data["sourceText"] == content
    assert data["entryRevision"] == 1
    assert len(data["suggestions"]) >= 2

    # Check suggestion integrity
    for sug in data["suggestions"]:
        start = sug["edit"]["start"]
        end = sug["edit"]["end"]
        orig = sug["edit"]["original"]
        assert content[start:end] == orig
        assert sug["explanation"]["title"]
        assert sug["explanation"]["message"]

    entry_id = data["entryId"]
    # Verify entry in db
    entry_res = client.get(f"/api/entries/{entry_id}", headers=headers)
    assert entry_res.status_code == 200
    entry_data = entry_res.json()
    assert entry_data["title"] == "Mi Mañana"
    assert entry_data["targetLanguage"] == "es"


def test_insights_aggregation_and_trend(client: TestClient):
    headers = {"X-Session-ID": "user-insights-test"}

    # 1. Analyze first entry
    res1 = client.post(
        "/api/entries/analyze",
        json={
            "content": "yo comer una manzana.",
            "targetLanguage": "es",
        },
        headers=headers,
    )
    assert res1.status_code == 200
    entry1_id = res1.json()["entryId"]
    sug1_id = res1.json()["suggestions"][0]["id"]

    # 2. Accept suggestion for entry 1
    dec_res = client.post(
        f"/api/entries/{entry1_id}/decisions",
        json={
            "expectedRevision": 1,
            "requestId": "req-insight-1",
            "decisions": [{"suggestionId": sug1_id, "action": "accepted"}],
        },
        headers=headers,
    )
    assert dec_res.status_code == 200

    # 3. Analyze second entry
    res2 = client.post(
        "/api/entries/analyze",
        json={
            "content": "esta manana es muy facil.",
            "targetLanguage": "es",
        },
        headers=headers,
    )
    assert res2.status_code == 200

    # 4. Fetch Insights
    insight_res = client.get("/api/insights", headers=headers)
    assert insight_res.status_code == 200
    data = insight_res.json()

    assert data["totalEntries"] == 2
    assert data["totalWords"] > 0
    assert data["totalSuggestions"] >= 3
    assert data["acceptedDecisions"] == 1
    assert len(data["categoryBreakdown"]) == 3
    assert len(data["topMistakes"]) >= 1
    assert len(data["recentTrends"]) >= 1


def test_defensive_llm_json_parsing():
    from backend.app.services.ai_service import clean_llm_json_response

    # 1. Plain JSON string
    raw1 = '[{"original_text": "comer", "replacement_text": "comí"}]'
    assert clean_llm_json_response(raw1) == raw1

    # 2. Markdown fenced JSON block
    raw2 = '```json\n[{"original_text": "comer", "replacement_text": "comí"}]\n```'
    assert clean_llm_json_response(raw2) == raw1

    # 3. Generic code block without json keyword
    raw3 = '```\n[{"original_text": "comer", "replacement_text": "comí"}]\n```'
    assert clean_llm_json_response(raw3) == raw1

    # 4. Leading / trailing whitespace and newlines
    raw4 = '  \n```json\n[{"original_text": "comer", "replacement_text": "comí"}]\n```\n  '
    assert clean_llm_json_response(raw4) == raw1
