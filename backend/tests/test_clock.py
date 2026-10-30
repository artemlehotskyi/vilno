from datetime import datetime, timedelta, timezone

import pytest

from app.services import clock

REAL = datetime(2026, 10, 30, 9, 0, tzinfo=timezone.utc)  # 11:00 за Києвом (UTC+2)


@pytest.fixture()
def db(SessionMaker):
    with SessionMaker() as session:
        yield session


def test_first_call_starts_from_demo_clock_start(db):
    n = clock.now(db, real=REAL)
    assert n == datetime(2026, 10, 30, 14, 0, tzinfo=clock.KYIV)
    assert n.tzinfo is not None


def test_clock_flows_with_real_time(db):
    clock.now(db, real=REAL)
    assert clock.now(db, real=REAL + timedelta(minutes=5)) == datetime(2026, 10, 30, 14, 5, tzinfo=clock.KYIV)


def test_advance(db):
    clock.now(db, real=REAL)
    assert clock.advance(db, 90, real=REAL) == datetime(2026, 10, 30, 15, 30, tzinfo=clock.KYIV)


def test_offset_survives_new_session(SessionMaker):
    with SessionMaker() as a:
        clock.advance(a, 60, real=REAL)
    with SessionMaker() as b:  # «перезапуск»: новий сеанс БД
        assert clock.now(b, real=REAL) == datetime(2026, 10, 30, 15, 0, tzinfo=clock.KYIV)


def test_set_and_reset(db):
    target = datetime(2026, 10, 31, 12, 0, tzinfo=clock.KYIV)
    assert clock.set_clock(db, target, real=REAL) == target
    assert clock.reset(db, real=REAL) == datetime(2026, 10, 30, 14, 0, tzinfo=clock.KYIV)


def test_set_clock_requires_timezone(db):
    with pytest.raises(ValueError):
        clock.set_clock(db, datetime(2026, 10, 30, 12, 0), real=REAL)


def test_db_roundtrip():
    dt = datetime(2026, 10, 30, 14, 0, tzinfo=clock.KYIV)
    assert clock.from_db(clock.to_db(dt)) == dt
    assert clock.to_db(dt) == datetime(2026, 10, 30, 12, 0)
