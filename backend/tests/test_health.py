from fastapi.testclient import TestClient

from app.main import app


def test_health():
    # без `with`: lifespan (секрети, БД, моделі) тестується окремо в test_audit_fixes.py
    r = TestClient(app).get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}
