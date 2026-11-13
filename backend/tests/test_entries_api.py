from fastapi.testclient import TestClient


def test_create_and_fetch_entry(client: TestClient):
    headers = {"X-Session-ID": "user-123"}
    create_payload = {
        "title": "Mi primer día",
        "targetLanguage": "es",
        "explanationLanguage": "en",
        "content": "Hoy fue un buen día.",
    }
    response = client.post("/api/entries", json=create_payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Mi primer día"
    assert data["targetLanguage"] == "es"
    assert data["content"] == "Hoy fue un buen día."
    assert data["revision"] == 1
    assert data["userId"] == "user-123"
    entry_id = data["id"]

    # Fetch by ID
    get_res = client.get(f"/api/entries/{entry_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == entry_id

    # List entries
    list_res = client.get("/api/entries", headers=headers)
    assert list_res.status_code == 200
    entries = list_res.json()
    assert len(entries) == 1
    assert entries[0]["id"] == entry_id


def test_manual_save_revision_concurrency(client: TestClient):
    headers = {"X-Session-ID": "user-123"}
    create_res = client.post(
        "/api/entries",
        json={
            "id": "entry-rev-1",
            "title": "Test",
            "targetLanguage": "es",
            "content": "Original content",
        },
        headers=headers,
    )
    assert create_res.status_code == 200
    assert create_res.json()["revision"] == 1

    # Save with matching expected revision (1) and updated content
    update_res = client.post(
        "/api/entries",
        json={
            "id": "entry-rev-1",
            "title": "Test",
            "targetLanguage": "es",
            "content": "Updated content",
            "expectedRevision": 1,
        },
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["revision"] == 2
    assert update_res.json()["content"] == "Updated content"

    # Conflicting save with stale revision (1 instead of current 2)
    conflict_res = client.post(
        "/api/entries",
        json={
            "id": "entry-rev-1",
            "title": "Test",
            "targetLanguage": "es",
            "content": "Stale update",
            "expectedRevision": 1,
        },
        headers=headers,
    )
    assert conflict_res.status_code == 409
    err = conflict_res.json()
    assert err["error"]["code"] == "REVISION_CONFLICT"


def test_target_language_change_increments_revision(client: TestClient):
    headers = {"X-Session-ID": "user-123"}
    create_res = client.post(
        "/api/entries",
        json={
            "id": "entry-lang-1",
            "title": "Lang Test",
            "targetLanguage": "es",
            "content": "Same content",
        },
        headers=headers,
    )
    assert create_res.status_code == 200
    assert create_res.json()["revision"] == 1

    # Change language to French
    lang_change_res = client.post(
        "/api/entries",
        json={
            "id": "entry-lang-1",
            "title": "Lang Test",
            "targetLanguage": "fr",
            "content": "Same content",
            "expectedRevision": 1,
        },
        headers=headers,
    )
    assert lang_change_res.status_code == 200
    assert lang_change_res.json()["revision"] == 2
    assert lang_change_res.json()["targetLanguage"] == "fr"


def test_soft_delete_entry_and_orphaned_data_preservation(client: TestClient):
    headers = {"X-Session-ID": "user-del-1"}

    # 1. Create and analyze an entry with phrases matched by offline heuristic
    content = "Hola, yo comer mucho caliente esta manana."
    analyze_payload = {
        "title": "Ayer",
        "targetLanguage": "es",
        "explanationLanguage": "en",
        "content": content,
    }
    analyze_res = client.post("/api/entries/analyze", json=analyze_payload, headers=headers)
    assert analyze_res.status_code == 200
    analysis_data = analyze_res.json()
    entry_id = analysis_data["entryId"]
    analysis_id = analysis_data["id"]
    assert len(analysis_data["suggestions"]) > 0

    # 2. Soft delete the entry
    del_res = client.delete(f"/api/entries/{entry_id}", headers=headers)
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert del_data["success"] is True
    assert del_data["id"] == entry_id
    assert del_data["deletedAt"] is not None

    # 3. GET /entries should exclude the soft-deleted entry
    list_res = client.get("/api/entries", headers=headers)
    assert list_res.status_code == 200
    active_entries = list_res.json()
    assert not any(e["id"] == entry_id for e in active_entries)

    # 4. GET /entries/{entry_id} should return 404
    get_res = client.get(f"/api/entries/{entry_id}", headers=headers)
    assert get_res.status_code == 404

    # 5. GET /entries with include_deleted=true includes it
    all_res = client.get("/api/entries?include_deleted=true", headers=headers)
    assert all_res.status_code == 200
    matching = [e for e in all_res.json() if e["id"] == entry_id]
    assert len(matching) == 1
    assert matching[0]["deletedAt"] is not None

    # 6. Attempting to update a soft-deleted entry is rejected
    update_res = client.post(
        "/api/entries",
        json={
            "id": entry_id,
            "title": "Ayer Updated",
            "targetLanguage": "es",
            "content": "New content",
        },
        headers=headers,
    )
    assert update_res.status_code == 400
    assert update_res.json()["error"]["code"] == "ENTRY_DELETED"

    # 7. Attempting to delete again returns 404
    second_del = client.delete(f"/api/entries/{entry_id}", headers=headers)
    assert second_del.status_code == 404

    # 8. CRITICAL: Verify that the analyses and suggestions STILL EXIST in the database
    # (Orphaned for later mode, NOT cascaded away)
    from backend.app.core.config import settings
    import sqlite3
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        # Journal entry exists in DB with deleted_at set
        entry_row = conn.execute("SELECT * FROM journal_entries WHERE id = ?;", (entry_id,)).fetchone()
        assert entry_row is not None
        assert entry_row["deleted_at"] is not None

        # Analysis record exists
        analyses_rows = conn.execute("SELECT * FROM analyses WHERE entry_id = ?;", (entry_id,)).fetchall()
        assert len(analyses_rows) >= 1
        assert analyses_rows[0]["id"] == analysis_id

        # Suggestions records exist
        sug_rows = conn.execute("SELECT * FROM suggestions WHERE analysis_id = ?;", (analysis_id,)).fetchall()
        assert len(sug_rows) > 0
    finally:
        conn.close()


def test_soft_delete_unauthorized_user(client: TestClient):
    headers_user_a = {"X-Session-ID": "user-a"}
    headers_user_b = {"X-Session-ID": "user-b"}

    create_res = client.post(
        "/api/entries",
        json={
            "title": "User A Entry",
            "targetLanguage": "es",
            "content": "Texto confidencial de A.",
        },
        headers=headers_user_a,
    )
    assert create_res.status_code == 200
    entry_id = create_res.json()["id"]

    # User B cannot delete User A's entry
    del_res = client.delete(f"/api/entries/{entry_id}", headers=headers_user_b)
    assert del_res.status_code == 403


def test_entry_history_retains_mistakes_when_accepted_or_dismissed(client: TestClient):
    headers = {"X-Session-ID": "user-history-test"}

    # 1. Create and analyze entry
    analyze_payload = {
        "title": "Mi viaje",
        "targetLanguage": "es",
        "content": "Yo comer mucho caliente esta manana.",
    }
    ana_res = client.post("/api/entries/analyze", json=analyze_payload, headers=headers)
    assert ana_res.status_code == 200
    ana_data = ana_res.json()
    entry_id = ana_data["entryId"]
    suggestions = ana_data["suggestions"]
    assert len(suggestions) >= 2

    sug1_id = suggestions[0]["id"]
    sug2_id = suggestions[1]["id"]

    # 2. Accept sug1
    dec_res = client.post(
        f"/api/entries/{entry_id}/decisions",
        json={
            "expectedRevision": 1,
            "requestId": "req-hist-1",
            "decisions": [{"suggestionId": sug1_id, "action": "accepted"}],
        },
        headers=headers,
    )
    assert dec_res.status_code == 200

    # 3. Dismiss sug2
    dec_res_2 = client.post(
        f"/api/entries/{entry_id}/decisions",
        json={
            "expectedRevision": 2,
            "requestId": "req-hist-2",
            "decisions": [{"suggestionId": sug2_id, "action": "dismissed"}],
        },
        headers=headers,
    )
    assert dec_res_2.status_code == 200

    # 4. Fetch entry history via GET /api/entries/{entry_id}
    get_res = client.get(f"/api/entries/{entry_id}", headers=headers)
    assert get_res.status_code == 200
    entry_detail = get_res.json()

    assert "mistakesHistory" in entry_detail
    mistakes = entry_detail["mistakesHistory"]
    assert len(mistakes) >= 2

    m1 = next((m for m in mistakes if m["id"] == sug1_id), None)
    assert m1 is not None
    assert m1["state"] == "accepted"
    assert m1["edit"]["original"] == suggestions[0]["edit"]["original"]
    assert m1["edit"]["replacement"] == suggestions[0]["edit"]["replacement"]
    assert m1["explanation"]["title"] != ""

    m2 = next((m for m in mistakes if m["id"] == sug2_id), None)
    assert m2 is not None
    assert m2["state"] == "dismissed"

    # Also verify GET /api/entries/{entry_id}/history endpoint
    hist_res = client.get(f"/api/entries/{entry_id}/history", headers=headers)
    assert hist_res.status_code == 200
    assert len(hist_res.json()["mistakesHistory"]) >= 2

