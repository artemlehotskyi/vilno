"""Фікси з аудиту: fail-fast без секретів, bootstrap (лоти + demo_state), гонка demo_state,
хвилини в scan_status, порожнє/бите фото → 422, межі вхідних даних."""
import json
from datetime import datetime, timedelta

import pytest
from sqlalchemy import func, select

import app.main as main
from app.config import require_secrets, settings
from app.models import DemoState, Lot, ParkingSession
from app.services import clock, cv
from app.services.plate import plate_hmac
from app.services.scan_status import evaluate

TOKEN = {"X-Demo-Token": "test-token"}
BIG = 10**30


# --- fail-fast ---

@pytest.mark.parametrize("key", ["PLATE_HMAC_KEY", "DEMO_TOKEN"])
def test_require_secrets_fails_without_key(monkeypatch, key):
    monkeypatch.setattr(settings, key, "")
    with pytest.raises(RuntimeError, match=key):
        require_secrets()


def test_require_secrets_ok():
    require_secrets()  # conftest задає обидва


# --- bootstrap ---

def test_bootstrap_imports_lots_into_empty_db_once(SessionMaker, monkeypatch):
    monkeypatch.setattr(main, "SessionLocal", SessionMaker)
    main.bootstrap()
    main.bootstrap()  # повторний старт нічого не дублює
    with SessionMaker() as db:
        assert db.scalar(select(func.count()).select_from(Lot)) == 54
        assert db.get(DemoState, 1) is not None


def test_bootstrap_does_not_reimport_non_empty(SessionMaker, monkeypatch):
    monkeypatch.setattr(main, "SessionLocal", SessionMaker)
    called = []
    monkeypatch.setattr("app.services.lots_import.import_lots", lambda db: called.append(1) or 0)
    with SessionMaker() as db:
        db.add(Lot(id=1, source_ids=[1], source="t", address="x", is_paid=False, lat=48.3, lon=25.9, points=[]))
        db.commit()
    main.bootstrap()
    assert called == []


def test_state_survives_concurrent_creation(SessionMaker):
    with SessionMaker() as a:
        clock.ensure_state(a)               # «інший запит» уже створив рядок
    with SessionMaker() as b:
        real_get = b.get
        calls = []

        def get_once_none(model, ident):
            calls.append(1)
            return None if len(calls) == 1 else real_get(model, ident)
        b.get = get_once_none                # цей запит ще не бачив рядка → спробує вставити
        st = clock._state(b)
        assert st is not None and st.id == 1  # IntegrityError проковтнуто, рядок прочитано


# --- хвилини після закриття як у тарифікації ---

def test_minutes_since_close_ignores_seconds(SessionMaker, client):
    with SessionMaker() as db:
        lot = db.scalars(select(Lot).where(Lot.zone == "center")).first()
        ended = datetime(2026, 10, 30, 15, 30, 0, 600_000, tzinfo=clock.KYIV)  # фініш о 15:30:00.6
        db.add(ParkingSession(id="s1", plate_hmac=plate_hmac("AA1234BB"), lot_id=lot.id,
                              started_at=clock.to_db(ended - timedelta(hours=1)), ended_at=clock.to_db(ended), status="finished"))
        db.commit()
        r = evaluate(db, plate_hmac("AA1234BB"), lot, datetime(2026, 10, 30, 15, 45, 0, 100_000, tzinfo=clock.KYIV))
    assert (r.status, r.minutes_since_close) == ("closed_but_present", 15)


# --- фото ---

def post_photo(client, data):
    return client.post("/api/recognize", files={"image": ("a.jpg", data, "image/jpeg")})


def test_empty_photo_422(client, monkeypatch):
    monkeypatch.setattr(settings, "CV_ENABLED", True)
    assert post_photo(client, b"").status_code == 422


def test_opencv_error_is_422(client, monkeypatch):
    monkeypatch.setattr(settings, "CV_ENABLED", True)

    def raise_cv2(*a, **k):
        raise cv.cv2.error("too many pixels")
    monkeypatch.setattr(cv.cv2, "imdecode", raise_cv2)
    assert post_photo(client, b"\x89PNG....").status_code == 422


def test_pixel_limit_is_set():
    import os
    assert int(os.environ["OPENCV_IO_MAX_IMAGE_PIXELS"]) <= 100_000_000


# --- межі ---

@pytest.mark.parametrize("path,body", [
    ("/api/sessions", {"plate": "AA1234BB", "lot_id": BIG}),
    ("/api/sessions", {"plate": "AA1234BB", "lot_id": 0}),
    ("/api/sessions", {"plate": "A" * 1000, "lot_id": 1}),
    ("/api/scans", {"plate": "AA1234BB", "lot_id": BIG}),
    ("/api/reports", {"lot_id": BIG, "client_id": "client-12345"}),
])
def test_lot_id_and_plate_bounds_422(client, path, body):
    assert client.post(path, json=body).status_code == 422


def test_lot_path_bounds_422(client):
    assert client.get(f"/api/lots/{BIG}").status_code == 422


@pytest.mark.parametrize("raw", ['{"advance_minutes": 1e20}', '{"advance_minutes": NaN}', '{"advance_minutes": Infinity}',
                                 '{"advance_minutes": -20000}', '{"set": "1990-01-01T00:00:00+02:00"}',
                                 '{"set": "9999-01-01T00:00:00+02:00"}'])
def test_demo_clock_bounds_422_and_api_survives(client, raw):
    r = client.post("/api/demo/clock", content=raw, headers={**TOKEN, "Content-Type": "application/json"})
    assert r.status_code == 422
    assert client.get("/api/clock").status_code == 200


def test_demo_clock_normal_values_ok(client):
    client.post("/api/demo/reset", headers=TOKEN)
    assert client.post("/api/demo/clock", json={"advance_minutes": 240}, headers=TOKEN).status_code == 200
    assert client.post("/api/demo/clock", json={"advance_minutes": -60}, headers=TOKEN).status_code == 200
    assert json.loads(client.get("/api/clock").text)["now"].startswith("2026-10-30T17:00")


def test_422_does_not_echo_input(client):
    r = client.post("/api/sessions", json={"plate": "A" * 40, "lot_id": "AA1234BB"})
    assert r.status_code == 422
    assert "AA1234BB" not in r.text and "input" not in r.text
