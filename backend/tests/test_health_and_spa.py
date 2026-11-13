from fastapi.testclient import TestClient


def test_root_and_api_health(client: TestClient):
    res_root = client.get("/health")
    assert res_root.status_code == 200
    assert res_root.json() == {"status": "ok"}

    res_api = client.get("/api/health")
    assert res_api.status_code == 200
    assert res_api.json() == {"status": "ok"}


def test_missing_api_route_returns_404(client: TestClient):
    res = client.get("/api/non-existent-endpoint")
    assert res.status_code == 404
