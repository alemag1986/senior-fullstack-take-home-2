from fastapi.testclient import TestClient


def test_cross_user_access_forbidden(client: TestClient):
    # User A creates an entry
    user_a_headers = {"X-Session-ID": "user-A"}
    res_a = client.post(
        "/api/entries",
        json={
            "id": "entry-user-a",
            "title": "Private Entry",
            "targetLanguage": "es",
            "content": "Contenido privado.",
        },
        headers=user_a_headers,
    )
    assert res_a.status_code == 200

    # User B attempts to fetch User A's entry
    user_b_headers = {"X-Session-ID": "user-B"}
    res_b = client.get("/api/entries/entry-user-a", headers=user_b_headers)
    assert res_b.status_code == 403
    err = res_b.json()
    assert err["error"]["code"] == "UNAUTHORIZED"

    # User B attempts to save/overwrite User A's entry
    res_b_save = client.post(
        "/api/entries",
        json={
            "id": "entry-user-a",
            "title": "Hacked Entry",
            "targetLanguage": "es",
            "content": "Contenido modificado.",
            "expectedRevision": 1,
        },
        headers=user_b_headers,
    )
    assert res_b_save.status_code == 403

    # User B attempts to post decisions on User A's entry
    res_b_dec = client.post(
        "/api/entries/entry-user-a/decisions",
        json={
            "expectedRevision": 1,
            "requestId": "req-b",
            "decisions": [{"suggestionId": "sug-fake", "action": "accepted"}],
        },
        headers=user_b_headers,
    )
    assert res_b_dec.status_code == 403


def test_health_endpoint(client: TestClient):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
