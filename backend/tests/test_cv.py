from pathlib import Path
from types import SimpleNamespace as NS

import numpy as np
import pytest

from app.config import settings
from app.services import cv

FIXTURE = Path(__file__).parent / "fixtures" / "car_us_plate.png"
IMG = np.zeros((100, 100, 3), np.uint8)


def alpr_returning(*items):
    """items: (text, confidence). Підміна fast-alpr без моделей."""
    results = [NS(ocr=NS(text=t, confidence=c)) for t, c in items]
    return NS(predict=lambda _img: results)


@pytest.fixture(autouse=True)
def reset_models(monkeypatch):
    monkeypatch.setattr(settings, "PLATE_CONF_MIN", 0.85)
    monkeypatch.setattr(settings, "CAR_CONF_MIN", 0.4)
    monkeypatch.setattr(cv, "_alpr", None)
    monkeypatch.setattr(cv, "_yolo", None)


def test_confident_valid_plate(monkeypatch):
    monkeypatch.setattr(cv, "_alpr", alpr_returning(("AA1234BB", 0.97)))
    assert cv.read_plate(IMG) == ("AA1234BB", 0.97)


def test_per_char_confidence_uses_min_over_real_chars(monkeypatch):
    # довіра списком з паддінгом: нулі після реальних символів не мають тягнути мінімум
    monkeypatch.setattr(cv, "_alpr", alpr_returning(("AA1234BB", [0.99] * 8 + [0.0, 0.0])))
    assert cv.read_plate(IMG)[0] == "AA1234BB"
    monkeypatch.setattr(cv, "_alpr", alpr_returning(("AA1234BB", [0.99] * 7 + [0.6, 0.0])))
    assert cv.read_plate(IMG) == (None, None)  # один сумнівний символ → unknown


def test_low_confidence_is_unknown(monkeypatch):
    monkeypatch.setattr(cv, "_alpr", alpr_returning(("AA1234BB", 0.80)))
    assert cv.read_plate(IMG) == (None, None)


def test_regex_failure_is_unknown(monkeypatch):
    monkeypatch.setattr(cv, "_alpr", alpr_returning(("5AU5341", 1.0), ("ZZ1234BB", 1.0)))
    assert cv.read_plate(IMG) == (None, None)


def test_ocr_position_fix_applied(monkeypatch):
    monkeypatch.setattr(cv, "_alpr", alpr_returning(("AA12O4BB", 0.95)))
    assert cv.read_plate(IMG)[0] == "AA1204BB"


def test_two_different_plates_is_ambiguous(monkeypatch):
    monkeypatch.setattr(cv, "_alpr", alpr_returning(("AA1234BB", 0.95), ("CC9999KK", 0.95)))
    assert cv.read_plate(IMG) == (None, None)


def test_same_plate_twice_is_fine(monkeypatch):
    monkeypatch.setattr(cv, "_alpr", alpr_returning(("AA1234BB", 0.90), ("AA1234BB", 0.96)))
    assert cv.read_plate(IMG) == ("AA1234BB", 0.96)


def test_no_alpr_means_no_plate():
    assert cv.read_plate(IMG) == (None, None)  # fallback: лише «є авто», номер вручну
    assert cv.detect_car(IMG) is None


def test_disabled(monkeypatch):
    monkeypatch.setattr(settings, "CV_ENABLED", False)
    assert cv.recognize(b"anything") == cv.Recognition(enabled=False)


def test_bad_image():
    with pytest.raises(cv.BadImage):
        cv.decode(b"not an image")


# --- ендпоінт ---

def post(client, data=b"x", name="a.jpg"):
    return client.post("/api/recognize", files={"image": (name, data, "image/jpeg")})


def test_endpoint_maps_result(client, monkeypatch):
    monkeypatch.setattr(cv, "recognize", lambda _d: cv.Recognition(True, True, "AA1234BB", 0.97))
    assert post(client).json() == {"enabled": True, "car_present": True, "plate": "AA1234BB", "plate_confidence": 0.97}


def test_endpoint_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "CV_ENABLED", False)
    r = post(client).json()
    assert r["enabled"] is False and r["plate"] is None


def test_endpoint_bad_image_422(client, monkeypatch):
    monkeypatch.setattr(settings, "CV_ENABLED", True)
    assert post(client, b"garbage").status_code == 422


def test_endpoint_too_big_413(client):
    assert post(client, b"0" * (10 * 1024 * 1024 + 1)).status_code == 413


# --- справжні моделі (потрібна мережа при першому запуску для завантаження ваг) ---

def test_real_models_car_detected_but_us_plate_rejected(monkeypatch):
    monkeypatch.setattr(settings, "CV_ENABLED", True)
    try:
        cv.load_models()
    except Exception as e:  # немає мережі / ваг
        pytest.skip(f"моделі недоступні: {e}")
    if cv._alpr is None:
        pytest.skip("fast-alpr недоступний")
    r = cv.recognize(FIXTURE.read_bytes())
    assert r.enabled and r.car_present is True
    assert r.plate is None  # американський номер не проходить регулярку → ручний ввід
