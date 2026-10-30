"""Сценарій F4: Пт 14:00 → старт → +90 хв → фініш → оплата; токен; 409/422; номер не в БД."""
import pytest
from sqlalchemy import text

TOKEN = {"X-Demo-Token": "test-token"}
PLATE = "AA 1234 BB"


@pytest.fixture()
def c(client):
    assert client.post("/api/demo/reset", headers=TOKEN).status_code == 200
    return client


def lots(c):
    return c.get("/api/lots").json()


def center_lot(c):
    return next(x for x in lots(c) if x["zone"] == "center")


def standard_ms_10(c):
    return next(x for x in lots(c) if x["zone"] == "standard" and x["tariff_per_hour"] == 10
                and x["operator_name"] == 'КП "Міськшеп"')


def free_lot(c):
    return next(x for x in lots(c) if not x["is_paid"])


def start(c, lot, plate=PLATE):
    return c.post("/api/sessions", json={"plate": plate, "lot_id": lot["id"]})


def advance(c, minutes):
    return c.post("/api/demo/clock", json={"advance_minutes": minutes}, headers=TOKEN)


# --- токен ---

def test_demo_endpoints_require_token(c):
    for method, path, body in [("post", "/api/demo/clock", {"advance_minutes": 1}), ("post", "/api/demo/reset", None)]:
        assert getattr(c, method)(path, json=body).status_code == 403
        assert getattr(c, method)(path, json=body, headers={"X-Demo-Token": "wrong"}).status_code == 403


def test_empty_demo_token_in_env_always_403(c, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "DEMO_TOKEN", "")
    assert c.post("/api/demo/reset", headers={"X-Demo-Token": ""}).status_code == 403
    assert c.post("/api/demo/reset").status_code == 403


def test_clock_is_public_and_starts_friday_14(c):
    r = c.get("/api/clock").json()
    assert r["now"].startswith("2026-10-30T14:00")


def test_clock_needs_exactly_one_field(c):
    assert c.post("/api/demo/clock", json={}, headers=TOKEN).status_code == 422
    assert c.post("/api/demo/clock", json={"advance_minutes": 1, "set": "2026-10-30T14:00:00+02:00"},
                  headers=TOKEN).status_code == 422
    assert c.post("/api/demo/clock", json={"set": "2026-10-30T14:00:00"}, headers=TOKEN).status_code == 422


# --- сценарій з PLAN: центр, +90 хв = 30,00 ---

def test_center_1h30_is_30_and_pay_flow(c):
    lot = center_lot(c)
    s = start(c, lot)
    assert s.status_code == 201
    sid = s.json()["id"]
    assert s.json()["status"] == "active" and s.json()["is_final"] is False

    advance(c, 90)
    live = c.get(f"/api/sessions/{sid}").json()
    assert live["amount_uah"] == 30.00 and live["minutes"] == 90  # «поки що»

    f = c.post(f"/api/sessions/{sid}/finish")
    assert f.status_code == 200
    body = f.json()
    assert body["status"] == "finished" and body["amount_uah"] == 30.00 and body["is_final"] is True
    assert body["breakdown"][0]["capped"] is False  # центр без ліміту

    p = c.post(f"/api/sessions/{sid}/pay")
    assert p.status_code == 200
    assert p.json()["status"] == "paid" and p.json()["payment_ref"].startswith("MOCK-")


def test_standard_cap_30_for_4_hours(c):
    s = start(c, standard_ms_10(c)).json()
    advance(c, 240)  # 14:00 → 18:00, лот працює до 19:00
    f = c.post(f"/api/sessions/{s['id']}/finish").json()
    assert f["amount_uah"] == 30.00                       # без ліміту було б 40
    assert f["breakdown"][0]["raw"] == 40.00 and f["breakdown"][0]["capped"] is True


def test_session_after_closing_time_is_free(c):
    s = start(c, center_lot(c)).json()
    advance(c, 6 * 60)  # 14:00 → 20:00: оплачуються лише 14–19
    f = c.post(f"/api/sessions/{s['id']}/finish").json()
    assert f["amount_uah"] == 100.00  # 5 год × 20


# --- помилки ---

def test_free_lot_returns_409(c):
    assert start(c, free_lot(c)).status_code == 409


def test_invalid_plate_422_and_unknown_lot_404(c):
    assert start(c, center_lot(c), plate="123").status_code == 422
    assert c.post("/api/sessions", json={"plate": PLATE, "lot_id": 99999}).status_code == 404


def test_cyrillic_and_spaces_accepted(c):
    assert start(c, center_lot(c), plate="аа 1234 вв").status_code == 201


def test_second_active_session_for_same_plate_409(c):
    lot = center_lot(c)
    assert start(c, lot).status_code == 201
    assert start(c, lot, plate="АА1234ВВ").status_code == 409  # той самий номер кирилицею


def test_double_finish_and_early_pay_409(c):
    sid = start(c, center_lot(c)).json()["id"]
    assert c.post(f"/api/sessions/{sid}/pay").status_code == 409
    assert c.post(f"/api/sessions/{sid}/finish").status_code == 200
    assert c.post(f"/api/sessions/{sid}/finish").status_code == 409
    c.post(f"/api/sessions/{sid}/pay")
    assert c.post(f"/api/sessions/{sid}/pay").status_code == 409


def test_unknown_session_404(c):
    assert c.get("/api/sessions/nope").status_code == 404


# --- мінімізація даних ---

def test_plate_is_not_stored_in_plaintext(c, SessionMaker):
    start(c, center_lot(c))
    with SessionMaker() as db:
        rows = db.execute(text("select * from sessions")).all()
    assert len(rows) == 1
    flat = " ".join(str(v) for v in rows[0])
    assert "AA1234BB" not in flat and "AA 1234 BB" not in flat
    assert len(rows[0].plate_hmac) == 64


# --- вплив на мапу і reset ---

def test_active_session_reduces_free_estimate_and_reset_clears(c):
    lot = center_lot(c)
    before = next(x for x in lots(c) if x["id"] == lot["id"])["free_estimate"]
    start(c, lot)
    after = next(x for x in lots(c) if x["id"] == lot["id"])["free_estimate"]
    assert after == max(0, before - 1)
    c.post("/api/demo/reset", headers=TOKEN)
    assert next(x for x in lots(c) if x["id"] == lot["id"])["free_estimate"] == before
