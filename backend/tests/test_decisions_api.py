from fastapi.testclient import TestClient


def test_decisions_full_lifecycle_and_sequential_acceptance(client: TestClient):
    headers = {"X-Session-ID": "user-decisions"}
    # 1. Create Entry: "Yo comer manzanas ayer."
    entry_res = client.post(
        "/api/entries",
        json={
            "id": "entry-flow-1",
            "title": "Flow Test",
            "targetLanguage": "es",
            "content": "Yo comer manzanas ayer.",
        },
        headers=headers,
    )
    assert entry_res.status_code == 200
    assert entry_res.json()["revision"] == 1

    # 2. Ingest Analysis with 2 suggestions:
    # s1: "comer" [3, 8] -> "comí"
    # s2: "ayer." [18, 23] -> "antier."
    analysis_payload = {
        "id": "analysis-1",
        "entryId": "entry-flow-1",
        "entryRevision": 1,
        "sourceText": "Yo comer manzanas ayer.",
        "suggestions": [
            {
                "id": "sug-1",
                "category": "grammar_syntax",
                "ruleCode": "grammar.verb_tense",
                "kind": "correction",
                "startOffset": 3,
                "endOffset": 8,
                "originalText": "comer",
                "replacementText": "comí",
                "explanationTitle": "Pretérito",
                "explanationMessage": "Usa pretérito indefinido.",
            },
            {
                "id": "sug-2",
                "category": "vocabulary_phrasing",
                "ruleCode": "vocabulary.word_choice",
                "kind": "improvement",
                "startOffset": 18,
                "endOffset": 23,
                "originalText": "ayer.",
                "replacementText": "antier.",
                "explanationTitle": "Vocabulario",
                "explanationMessage": "Palabra más precisa.",
            },
        ],
    }
    ana_res = client.post("/api/analyses", json=analysis_payload, headers=headers)
    assert ana_res.status_code == 200
    assert ana_res.json()["status"] == "completed"
    assert len(ana_res.json()["suggestions"]) == 2

    # 3. First Decision: Accept sug-1
    dec_res_1 = client.post(
        "/api/entries/entry-flow-1/decisions",
        json={
            "expectedRevision": 1,
            "requestId": "req-1",
            "decisions": [{"suggestionId": "sug-1", "action": "accepted"}],
        },
        headers=headers,
    )
    assert dec_res_1.status_code == 200
    data_1 = dec_res_1.json()
    assert data_1["entry"]["content"] == "Yo comí manzanas ayer."
    assert data_1["entry"]["revision"] == 2
    assert len(data_1["actions"]) == 1
    assert data_1["actions"][0]["suggestionId"] == "sug-1"
    assert data_1["actions"][0]["action"] == "accepted"

    # 4. Idempotent Retry of req-1 with same expectedRevision (1) returns cached result without re-applying
    retry_res = client.post(
        "/api/entries/entry-flow-1/decisions",
        json={
            "expectedRevision": 1,
            "requestId": "req-1",
            "decisions": [{"suggestionId": "sug-1", "action": "accepted"}],
        },
        headers=headers,
    )
    assert retry_res.status_code == 200
    assert retry_res.json()["entry"]["content"] == "Yo comí manzanas ayer."
    assert retry_res.json()["entry"]["revision"] == 2

    # 5. Sequential Decision: Accept sug-2 from the same analysis, expectedRevision is now 2
    dec_res_2 = client.post(
        "/api/entries/entry-flow-1/decisions",
        json={
            "expectedRevision": 2,
            "requestId": "req-2",
            "decisions": [{"suggestionId": "sug-2", "action": "accepted"}],
        },
        headers=headers,
    )
    assert dec_res_2.status_code == 200
    data_2 = dec_res_2.json()
    assert data_2["entry"]["content"] == "Yo comí manzanas antier."
    assert data_2["entry"]["revision"] == 3


def test_dismissal_does_not_change_text_or_revision(client: TestClient):
    headers = {"X-Session-ID": "user-dismiss"}
    client.post(
        "/api/entries",
        json={
            "id": "entry-dismiss-1",
            "title": "Dismiss Test",
            "targetLanguage": "es",
            "content": "Texto original.",
        },
        headers=headers,
    )
    client.post(
        "/api/analyses",
        json={
            "id": "analysis-dismiss-1",
            "entryId": "entry-dismiss-1",
            "entryRevision": 1,
            "sourceText": "Texto original.",
            "suggestions": [
                {
                    "id": "sug-d1",
                    "category": "spelling_accents",
                    "ruleCode": "spelling.capitalization",
                    "kind": "improvement",
                    "startOffset": 0,
                    "endOffset": 5,
                    "originalText": "Texto",
                    "replacementText": "TEXTO",
                    "explanationTitle": "Mayúsculas",
                    "explanationMessage": "Estilo.",
                }
            ],
        },
        headers=headers,
    )

    dec_res = client.post(
        "/api/entries/entry-dismiss-1/decisions",
        json={
            "expectedRevision": 1,
            "requestId": "req-dismiss",
            "decisions": [{"suggestionId": "sug-d1", "action": "dismissed"}],
        },
        headers=headers,
    )
    assert dec_res.status_code == 200
    data = dec_res.json()
    assert data["entry"]["content"] == "Texto original."
    assert data["entry"]["revision"] == 1
    assert data["actions"][0]["action"] == "dismissed"


def test_manual_edit_invalidates_further_decisions(client: TestClient):
    headers = {"X-Session-ID": "user-manual-edit"}
    client.post(
        "/api/entries",
        json={
            "id": "entry-inv-1",
            "title": "Invalidate Test",
            "targetLanguage": "es",
            "content": "Frase para editar.",
        },
        headers=headers,
    )
    client.post(
        "/api/analyses",
        json={
            "id": "analysis-inv-1",
            "entryId": "entry-inv-1",
            "entryRevision": 1,
            "sourceText": "Frase para editar.",
            "suggestions": [
                {
                    "id": "sug-inv",
                    "category": "grammar_syntax",
                    "ruleCode": "grammar.word_order",
                    "kind": "improvement",
                    "startOffset": 0,
                    "endOffset": 5,
                    "originalText": "Frase",
                    "replacementText": "Oración",
                    "explanationTitle": "Sinónimo",
                    "explanationMessage": "Palabra alternativa.",
                }
            ],
        },
        headers=headers,
    )

    # User performs a manual edit via saveEntry
    client.post(
        "/api/entries",
        json={
            "id": "entry-inv-1",
            "title": "Invalidate Test",
            "targetLanguage": "es",
            "content": "Frase que fue modificada manualmente.",
            "expectedRevision": 1,
        },
        headers=headers,
    )

    # Attempting to decide on the old suggestion must be rejected
    dec_res = client.post(
        "/api/entries/entry-inv-1/decisions",
        json={
            "expectedRevision": 2,
            "requestId": "req-after-manual",
            "decisions": [{"suggestionId": "sug-inv", "action": "accepted"}],
        },
        headers=headers,
    )
    assert dec_res.status_code == 409
    err = dec_res.json()
    assert err["error"]["code"] == "REVIEW_SEQUENCE_INVALIDATED"


def test_contradictory_action_rejection(client: TestClient):
    headers = {"X-Session-ID": "user-contra"}
    client.post(
        "/api/entries",
        json={
            "id": "entry-contra-1",
            "title": "Contra Test",
            "targetLanguage": "es",
            "content": "Comer manzanas.",
        },
        headers=headers,
    )
    client.post(
        "/api/analyses",
        json={
            "id": "analysis-contra-1",
            "entryId": "entry-contra-1",
            "entryRevision": 1,
            "sourceText": "Comer manzanas.",
            "suggestions": [
                {
                    "id": "sug-c1",
                    "category": "grammar_syntax",
                    "ruleCode": "grammar.verb_tense",
                    "kind": "correction",
                    "startOffset": 0,
                    "endOffset": 5,
                    "originalText": "Comer",
                    "replacementText": "Comí",
                    "explanationTitle": "Verbo",
                    "explanationMessage": "Tiempo pasado.",
                }
            ],
        },
        headers=headers,
    )

    # 1. Accept sug-c1
    client.post(
        "/api/entries/entry-contra-1/decisions",
        json={
            "expectedRevision": 1,
            "requestId": "req-c1",
            "decisions": [{"suggestionId": "sug-c1", "action": "accepted"}],
        },
        headers=headers,
    )

    # 2. Try to dismiss already accepted sug-c1 in a new request
    contra_res = client.post(
        "/api/entries/entry-contra-1/decisions",
        json={
            "expectedRevision": 2,
            "requestId": "req-c2",
            "decisions": [{"suggestionId": "sug-c1", "action": "dismissed"}],
        },
        headers=headers,
    )
    assert contra_res.status_code == 409
    assert contra_res.json()["error"]["code"] == "CONTRADICTORY_ACTION"


def test_analysis_all_candidates_rejected_fails_status(client: TestClient):
    headers = {"X-Session-ID": "user-validation-fail"}
    client.post(
        "/api/entries",
        json={
            "id": "entry-fail-1",
            "title": "Fail Test",
            "targetLanguage": "es",
            "content": "Texto simple.",
        },
        headers=headers,
    )

    # Provide candidate suggestions with invalid rule codes
    res = client.post(
        "/api/analyses",
        json={
            "id": "analysis-fail-1",
            "entryId": "entry-fail-1",
            "entryRevision": 1,
            "sourceText": "Texto simple.",
            "suggestions": [
                {
                    "id": "bad-sug",
                    "category": "grammar_syntax",
                    "ruleCode": "invalid.fake_rule",
                    "kind": "correction",
                    "startOffset": 0,
                    "endOffset": 5,
                    "originalText": "Texto",
                    "replacementText": "TEXT",
                    "explanationTitle": "Bad",
                    "explanationMessage": "Bad",
                }
            ],
        },
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "failed"
    assert data["errorCode"] == "VALIDATION_ALL_CANDIDATES_REJECTED"
    assert len(data["suggestions"]) == 0


def test_analysis_valid_empty_succeeds(client: TestClient):
    headers = {"X-Session-ID": "user-empty-valid"}
    client.post(
        "/api/entries",
        json={
            "id": "entry-clean-1",
            "title": "Clean Test",
            "targetLanguage": "es",
            "content": "Este texto no tiene errores.",
        },
        headers=headers,
    )

    # An empty suggestions list is a valid review with 0 mistakes
    res = client.post(
        "/api/analyses",
        json={
            "id": "analysis-clean-1",
            "entryId": "entry-clean-1",
            "entryRevision": 1,
            "sourceText": "Este texto no tiene errores.",
            "suggestions": [],
        },
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "completed"
    assert data["errorCode"] is None
    assert len(data["suggestions"]) == 0
