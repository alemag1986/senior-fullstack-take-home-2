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
