"""fix(F5): водій не стартує сесію без фото, на якому CV знайшов авто.
CV недоступний або впав → старт дозволено з capture_method='fallback' («фото не перевірено»)."""
import pytest

from app.services import cv, photo_token

TOKEN = {"X-Demo-Token": "test-token"}


@pytest.fixture()
def c(client):
    client.post("/api/demo/reset", headers=TOKEN)
    return client


@pytest.fixture()
def cv_up(monkeypatch):
    monkeypatch.setattr(cv, "_yolo", object())  # «модель завантажена»
    monkeypatch.setattr(cv, "_broken", False)


def lot_id(c):
    return next(x["id"] for x in c.get("/api/lots").json() if x["zone"] == "center")


def start(c, token=None, plate="AA 1234 BB"):
    body = {"plate": plate, "lot_id": lot_id(c)}
    if token is not None:
        body["car_token"] = token
    return c.post("/api/sessions", json=body)


def recognize(c):
    return c.post("/api/recognize", files={"image": ("a.jpg", b"x", "image/jpeg")})


# --- CV доступний: без фото з авто старту немає ---

def test_no_photo_blocks_start_when_cv_available(c, cv_up):
    r = start(c)
    assert r.status_code == 422 and "сфотографуйте" in r.json()["detail"]


def test_valid_car_token_starts_live(c, cv_up):
    r = start(c, token=photo_token.issue())
    assert r.status_code == 201 and r.json()["capture_method"] == "live"


@pytest.mark.parametrize("bad", ["", "garbage", "123.abc", "1.deadbeef"])
def test_forged_token_blocked(c, cv_up, bad):
    assert start(c, token=bad).status_code == 422


def test_expired_token_blocked(c, cv_up):
    old = photo_token.issue(now=1_000_000)
    assert photo_token.verify(old, now=1_000_000 + photo_token.TTL_SEC) is True
    assert photo_token.verify(old, now=1_000_000 + photo_token.TTL_SEC + 1) is False
    assert start(c, token=old).status_code == 422


def test_token_signed_with_server_key(monkeypatch):
    t = photo_token.issue(now=1_000_000)
    from app.config import settings
    monkeypatch.setattr(settings, "PLATE_HMAC_KEY", "other-key")
    assert photo_token.verify(t, now=1_000_000) is False


# --- /recognize видає токен лише коли авто знайдено ---

def test_token_only_when_car_present(c, cv_up, monkeypatch):
    monkeypatch.setattr(cv, "recognize", lambda _d: cv.Recognition(True, True, None, None))
    r = recognize(c).json()
    assert r["car_token"] and r["cv_available"] is True
    assert start(c, token=r["car_token"]).json()["capture_method"] == "live"


def test_no_car_no_token_start_blocked(c, cv_up, monkeypatch):
    monkeypatch.setattr(cv, "recognize", lambda _d: cv.Recognition(True, False, None, None))
    r = recognize(c).json()
    assert r["car_present"] is False and r["car_token"] is None
    assert start(c).status_code == 422


# --- CV недоступний / впав → fallback ---

def test_cv_disabled_allows_fallback(c, cv_up, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "CV_ENABLED", False)
    r = start(c)
    assert r.status_code == 201 and r.json()["capture_method"] == "fallback"


def test_models_not_loaded_allows_fallback(c):
    r = start(c)  # conftest: _yolo=None
    assert r.status_code == 201 and r.json()["capture_method"] == "fallback"


def test_cv_crash_returns_200_and_then_allows_fallback(c, cv_up, monkeypatch):
    def boom(_d):
        cv._broken = True  # так робить справжній recognize при винятку моделі
        raise cv.CVFailed("model exploded")
    monkeypatch.setattr(cv, "recognize", boom)
    r = recognize(c)
    assert r.status_code == 200
    body = r.json()
    assert body["car_present"] is None and body["car_token"] is None and body["cv_available"] is False
    s = start(c)
    assert s.status_code == 201 and s.json()["capture_method"] == "fallback"


def test_real_recognize_marks_cv_broken_on_model_error(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "CV_ENABLED", True)

    class Exploding:
        def predict(self, *a, **k):
            raise RuntimeError("onnx died")
    monkeypatch.setattr(cv, "_yolo", Exploding())
    import cv2
    import numpy as np
    ok, png = cv2.imencode(".png", np.zeros((10, 10, 3), np.uint8))
    with pytest.raises(cv.CVFailed):
        cv.recognize(png.tobytes())
    assert cv.available() is False
