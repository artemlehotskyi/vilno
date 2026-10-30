"""11 тест-кейсів з ARCHITECTURE §5.2 + порядок правил. GRACE_END_MIN=10, вікно closed_but_present=240.
now = Пт 30.10.2026 14:00 (Київ); МіськШЕП працює Пн–Пт 09–19."""
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import Lot, ParkingSession
from app.services import clock
from app.services.plate import plate_hmac
from app.services.scan_status import evaluate

NOW = datetime(2026, 10, 30, 14, 0, tzinfo=clock.KYIV)
SATURDAY = datetime(2026, 10, 31, 12, 0, tzinfo=clock.KYIV)
H = "AA1234BB"


@pytest.fixture()
def env(SessionMaker, client):  # client імпортує лоти в ту саму БД
    with SessionMaker() as db:
        l1, l2 = db.scalars(select(Lot).where(Lot.zone == "center").order_by(Lot.id)).all()[:2]
        yield db, l1, l2


def add(db, lot, closed_min_ago: int | None, plate: str = H):
    """closed_min_ago=None → активна сесія; число → закрита стільки хвилин тому."""
    ended = None if closed_min_ago is None else clock.to_db(NOW - timedelta(minutes=closed_min_ago))
    db.add(ParkingSession(id=f"s{db.query(ParkingSession).count()}", plate_hmac=plate_hmac(plate), lot_id=lot.id,
                          started_at=clock.to_db(NOW - timedelta(hours=3)), ended_at=ended,
                          status="active" if ended is None else "finished"))
    db.commit()


def scan(db, lot, plate: str | None = H, now: datetime = NOW):
    return evaluate(db, plate_hmac(plate) if plate else None, lot, now)


def test_01_plate_not_confirmed_is_unknown(env):
    db, l1, _ = env
    r = scan(db, l1, plate=None)
    assert r.status == "unknown" and r.paid_now is True


def test_02_outside_opening_hours(env):
    db, l1, _ = env
    r = scan(db, l1, now=SATURDAY)
    assert r.paid_now is False and r.status == "unknown"
    assert r.recheck_after_min is None  # жодних висновків про неоплату


def test_03_active_session_here(env):
    db, l1, _ = env
    add(db, l1, None)
    r = scan(db, l1)
    assert (r.status, r.grace_after_close, r.session_on_other_lot) == ("active", False, False)


def test_04_active_session_on_other_lot_is_unpaid(env):
    db, l1, l2 = env
    add(db, l2, None)
    r = scan(db, l1)
    assert r.status == "unpaid" and r.session_on_other_lot is True


def test_05_closed_5_min_ago_grace(env):
    db, l1, _ = env
    add(db, l1, 5)
    r = scan(db, l1)
    assert (r.status, r.grace_after_close, r.minutes_since_close) == ("active", True, 5)


def test_06_closed_exactly_10_min_still_grace(env):
    db, l1, _ = env
    add(db, l1, 10)
    r = scan(db, l1)
    assert (r.status, r.grace_after_close, r.minutes_since_close) == ("active", True, 10)


def test_07_closed_11_min_ago_closed_but_present(env):
    db, l1, _ = env
    add(db, l1, 11)
    r = scan(db, l1)
    assert (r.status, r.minutes_since_close, r.grace_after_close) == ("closed_but_present", 11, False)


def test_08_closed_240_min_ago_still_closed_but_present(env):
    db, l1, _ = env
    add(db, l1, 240)
    r = scan(db, l1)
    assert (r.status, r.minutes_since_close) == ("closed_but_present", 240)


def test_09_closed_241_min_ago_is_unpaid(env):
    db, l1, _ = env
    add(db, l1, 241)
    assert scan(db, l1).status == "unpaid"


def test_10_closed_on_other_lot_is_unpaid_not_closed_but_present(env):
    db, l1, l2 = env
    add(db, l2, 30)
    r = scan(db, l1)
    assert r.status == "unpaid" and r.session_on_other_lot is False


def test_11_no_sessions_unpaid_with_recheck_hint(env):
    db, l1, _ = env
    r = scan(db, l1)
    assert (r.status, r.recheck_after_min, r.session_on_other_lot) == ("unpaid", 10, False)


# --- порядок правил і межі ---

def test_active_here_beats_recent_close_here(env):
    db, l1, _ = env
    add(db, l1, 30)
    add(db, l1, None)
    assert scan(db, l1).status == "active"


def test_recent_close_here_beats_active_on_other_lot(env):
    db, l1, l2 = env
    add(db, l1, 30)
    add(db, l2, None)
    r = scan(db, l1)
    assert r.status == "closed_but_present" and r.minutes_since_close == 30


def test_other_plate_not_affected(env):
    db, l1, _ = env
    add(db, l1, None, plate="CC9999KK")
    assert scan(db, l1).status == "unpaid"


def test_active_session_outside_hours_gives_no_conclusion(env):
    db, l1, _ = env
    add(db, l1, None)
    r = scan(db, l1, now=SATURDAY)
    assert r.paid_now is False and r.status == "unknown"


def test_grace_and_window_are_configurable(env):
    db, l1, _ = env
    add(db, l1, 20)
    assert evaluate(db, plate_hmac(H), l1, NOW, grace_min=30).status == "active"
    assert evaluate(db, plate_hmac(H), l1, NOW, grace_min=10, window_min=15).status == "unpaid"
