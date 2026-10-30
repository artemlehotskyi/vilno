"""Сценарій демо: водій закрив сесію → скан одразу (grace) → +15 хв → closed_but_present."""
import pytest
from sqlalchemy import text

TOKEN = {"X-Demo-Token": "test-token"}


@pytest.fixture()
def c(client):
    client.post("/api/demo/reset", headers=TOKEN)
    return client


def center(c):
    return next(x for x in c.get("/api/lots").json() if x["zone"] == "center")


def scan(c, lot, plate="AA 1234 BB", **kw):
    return c.post("/api/scans", json={"plate": plate, "lot_id": lot["id"], **kw})


def advance(c, minutes):
    c.post("/api/demo/clock", json={"advance_minutes": minutes}, headers=TOKEN)


def test_demo_scenario_closed_but_present(c):
    lot = center(c)
    sid = c.post("/api/sessions", json={"plate": "AA 1234 BB", "lot_id": lot["id"]}).json()["id"]
    assert scan(c, lot).json()["status"] == "active"

    advance(c, 30)
    c.post(f"/api/sessions/{sid}/finish")
    r = scan(c, lot).json()  # одразу після фінішу
    assert (r["status"], r["grace_after_close"], r["minutes_since_close"]) == ("active", True, 0)

    advance(c, 15)
    r = scan(c, lot).json()
    assert (r["status"], r["minutes_since_close"], r["grace_after_close"]) == ("closed_but_present", 15, False)


def test_unpaid_has_recheck_hint(c):
    r = scan(c, center(c), plate="BB 5555 CC").json()
    assert r["status"] == "unpaid" and r["recheck_after_min"] == 10 and r["paid_now"] is True


def test_no_plate_is_unknown(c):
    r = c.post("/api/scans", json={"plate": None, "lot_id": center(c)["id"]}).json()
    assert r["status"] == "unknown"


def test_outside_hours_not_logged(c, SessionMaker):
    c.post("/api/demo/clock", json={"set": "2026-10-31T12:00:00+02:00"}, headers=TOKEN)  # субота
    r = scan(c, center(c)).json()
    assert r["paid_now"] is False
    with SessionMaker() as db:
        assert db.execute(text("select count(*) from scans")).scalar() == 0


def test_scan_logged_without_plaintext_and_reset_clears(c, SessionMaker):
    scan(c, center(c), ocr_source="cv")
    with SessionMaker() as db:
        rows = db.execute(text("select * from scans")).all()
        assert len(rows) == 1 and rows[0].ocr_source == "cv"
        assert "AA1234BB" not in " ".join(str(v) for v in rows[0])
    c.post("/api/demo/reset", headers=TOKEN)
    with SessionMaker() as db:
        assert db.execute(text("select count(*) from scans")).scalar() == 0


def test_validation(c):
    lot = center(c)
    assert scan(c, lot, plate="123").status_code == 422
    assert c.post("/api/scans", json={"plate": "AA1234BB", "lot_id": 99999}).status_code == 404
    assert scan(c, lot, ocr_source="llm").status_code == 422  # LLM-розпізнавання прибрано
