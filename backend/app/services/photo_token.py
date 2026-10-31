"""Короткоживучий підписаний токен «CV знайшов авто на фото». Без нього старт сесії заборонено,
доки CV доступний. Реальний час (не демо-годинник): токен живе TTL_SEC від моменту фото.
Прототип: токен не прив'язаний до номера й не одноразовий (PLAN §5)."""
import hashlib
import hmac
import time

from app.config import settings

TTL_SEC = 15 * 60


def _sig(ts: int) -> str:
    key = settings.PLATE_HMAC_KEY.encode()
    return hmac.new(key, f"car-photo:{ts}".encode(), hashlib.sha256).hexdigest()


def issue(now: float | None = None) -> str:
    ts = int(now if now is not None else time.time())
    return f"{ts}.{_sig(ts)}"


def verify(token: str, now: float | None = None) -> bool:
    try:
        ts_s, sig = token.split(".", 1)
        ts = int(ts_s)
    except ValueError:
        return False
    current = now if now is not None else time.time()
    if not 0 <= current - ts <= TTL_SEC:
        return False
    return hmac.compare_digest(sig, _sig(ts))
