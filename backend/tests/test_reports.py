"""feat(C5): скарга «місць насправді немає». Відповідь завжди {"ok": true}; кулдаун; на скани не впливає."""
import pytest
from sqlalchemy import text

from app.config import settings

TOKEN = {"X-Demo-Token": "test-token"}
PLATE = "AA 1234 BB"
CLIENT = "client-aaaaaaaa"


@pytest.fixture()
def c(client, monkeypatch):
    monkeypatch.setattr(settings, "REPORT_COOLDOWN_MIN", 30)
    client.post("/api/demo/reset", headers=TOKEN)
    return client


def lots(c, zone="center"):
    return [x["id"] for x in c.get("/api/lots").json() if x["zone"] == zone]


def report(c, lot, plate=PLATE, client=CLIENT):
    return c.post("/api/reports", json={"lot_id": lot, "plate": plate, "client_id": client})


def conf(row):
    """SQLite віддає булеві як 1/0 (або None)."""
    return None if row.confirmed is None else bool(row.confirmed)


def reports_rows(SessionMaker):
    with SessionMaker() as db:
        return db.execute(text("select * from reports order by created_at")).all()


def advance(c, minutes):
    c.post("/api/demo/clock", json={"advance_minutes": minutes}, headers=TOKEN)


# --- відповідь однакова незалежно від результату звірки ---

def test_same_response_whether_confirmed_or_not(c, SessionMaker):
    l1, l2 = lots(c)[:2]
    c.post("/api/sessions", json={"plate": PLATE, "lot_id": l1})          # оплачено на l1
    paid = report(c, l1, client="client-111111")                          # звірка: сесія є → confirmed=False
    unpaid = report(c, l2, client="client-222222")                        # на l2 сесії немає → confirmed=True
    no_plate = report(c, l2, plate=None, client="client-333333")
    assert paid.status_code == unpaid.status_code == no_plate.status_code == 200
    assert paid.json() == unpaid.json() == no_plate.json() == {"ok": True}
    assert paid.headers.get("content-length") == unpaid.headers.get("content-length")
    got = {(r.lot_id == l1, conf(r)) for r in reports_rows(SessionMaker)}
    assert got == {(True, False), (False, True), (False, None)}


def test_active_session_on_other_lot_does_not_count(c, SessionMaker):
    l1, l2 = lots(c)[:2]
    c.post("/api/sessions", json={"plate": PLATE, "lot_id": l2})
    report(c, l1)
    assert conf(reports_rows(SessionMaker)[0]) is True  # звіряємо лише з ЦИМ лотом


def test_finished_session_counts_as_no_session(c, SessionMaker):
    l1 = lots(c)[0]
    sid = c.post("/api/sessions", json={"plate": PLATE, "lot_id": l1}).json()["id"]
    c.post(f"/api/sessions/{sid}/finish")
    report(c, l1)
    assert conf(reports_rows(SessionMaker)[0]) is True


# --- ліміт ---

def test_cooldown_per_client_and_lot(c, SessionMaker):
    l1, l2 = lots(c)[:2]
    assert report(c, l1).json() == {"ok": True}
    assert report(c, l1).json() == {"ok": True}           # повтор: відповідь та сама, але не збережено
    assert len(reports_rows(SessionMaker)) == 1
    report(c, l2)                                          # інший лот — можна
    report(c, l1, client="client-other1")                  # інший клієнт — можна
    assert len(reports_rows(SessionMaker)) == 3
    advance(c, 29)
    report(c, l1)
    assert len(reports_rows(SessionMaker)) == 3            # ще в межах 30 хв
    advance(c, 2)
    report(c, l1)
    assert len(reports_rows(SessionMaker)) == 4            # 31 хв → знову можна


# --- скарга НІКОЛИ не впливає на скан ---

def scan(c, lot, plate=PLATE):
    return c.post("/api/scans", json={"plate": plate, "lot_id": lot}).json()


@pytest.mark.parametrize("with_session", [False, True])
def test_report_does_not_change_scan_status(c, with_session):
    l1 = lots(c)[0]
    if with_session:
        c.post("/api/sessions", json={"plate": PLATE, "lot_id": l1})
    before = scan(c, l1)
    for i in range(5):
        report(c, l1, client=f"client-spam-{i}")
    after = scan(c, l1)
    drop = ("scanned_at",)
    assert {k: v for k, v in before.items() if k not in drop} == {k: v for k, v in after.items() if k not in drop}
    assert after["status"] == ("active" if with_session else "unpaid")


def test_report_creates_no_scan_or_session(c, SessionMaker):
    report(c, lots(c)[0])
    with SessionMaker() as db:
        assert db.execute(text("select count(*) from scans")).scalar() == 0
        assert db.execute(text("select count(*) from sessions")).scalar() == 0


# --- приватність і валідація ---

def test_plate_and_client_not_stored_in_plaintext(c, SessionMaker):
    report(c, lots(c)[0])
    row = reports_rows(SessionMaker)[0]
    flat = " ".join(str(v) for v in row)
    assert "AA1234BB" not in flat and CLIENT not in flat
    assert len(row.plate_hmac) == 64 and len(row.client_hmac) == 64


def test_validation(c):
    l1 = lots(c)[0]
    assert report(c, l1, plate="123").status_code == 422
    assert c.post("/api/reports", json={"lot_id": l1, "client_id": "short"}).status_code == 422
    assert c.post("/api/reports", json={"lot_id": 99999, "client_id": CLIENT}).status_code == 404


def test_reset_clears_reports(c, SessionMaker):
    report(c, lots(c)[0])
    c.post("/api/demo/reset", headers=TOKEN)
    assert reports_rows(SessionMaker) == []


# --- дашборд ---

def dispatch(c):
    return c.get("/api/stats/dispatch").json()["rows"]


def test_dashboard_counts_signals_last_hour(c):
    l1 = lots(c)[0]
    report(c, l1, client="client-a0000000")                # confirmed=True (сесії немає)
    report(c, l1, plate=None, client="client-b0000000")    # без номера → не підтверджено
    row = next(r for r in dispatch(c) if r["lot_id"] == l1)
    assert (row["reports_1h"], row["reports_confirmed_1h"]) == (2, 1)
    advance(c, 61)
    row = next(r for r in dispatch(c) if r["lot_id"] == l1)
    assert (row["reports_1h"], row["reports_confirmed_1h"]) == (0, 0)


def test_confirmed_signal_lifts_lot_without_changing_benefit(c):
    before = dispatch(c)
    last = before[-1]                                      # найменша вигода
    report(c, last["lot_id"])                              # підтверджена скарга
    after = dispatch(c)
    assert after[0]["lot_id"] == last["lot_id"]            # піднявся нагору
    assert after[0]["expected_benefit_uah"] == last["expected_benefit_uah"]  # симуляцію не чіпаємо
    assert after[0]["decision"] == last["decision"]


def test_unconfirmed_signal_does_not_lift(c):
    before = [r["lot_id"] for r in dispatch(c)]
    report(c, before[-1], plate=None)
    assert [r["lot_id"] for r in dispatch(c)] == before
