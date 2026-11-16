def test_health_returns_ok(client):
    """GET /health must return 200 with body {"status": "ok"}."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
