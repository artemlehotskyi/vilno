"""Статус скану інспектора (ARCHITECTURE §5.2, рішення PLAN §0). Правила зверху вниз, спрацьовує перше.
Статусів лише чотири: active / unpaid / closed_but_present / unknown. Уточнення йдуть полями відповіді.
Система рекомендує, штраф оформлює людина. Невпевнено → unknown."""
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Lot, ParkingSession
from app.services import clock
from app.services.tariff import is_open_at


@dataclass
class ScanResult:
    status: str
    paid_now: bool                         # чи діє зараз платне паркування на цьому лоті
    minutes_since_close: int | None = None
    grace_after_close: bool = False        # active, бо сесію щойно закрито (пільговий час)
    session_on_other_lot: bool = False
    recheck_after_min: int | None = None   # для unpaid: «повторіть скан через N хв»


def evaluate(db: Session, plate_hmac: str | None, lot: Lot, now: datetime,
             grace_min: int | None = None, window_min: int | None = None) -> ScanResult:
    grace = settings.GRACE_END_MIN if grace_min is None else grace_min
    window = settings.CLOSED_PRESENT_WINDOW_MIN if window_min is None else window_min
    paid_now = is_open_at(lot.opening_hours, now)

    # 1. Номер не підтверджено → unknown
    if plate_hmac is None:
        return ScanResult("unknown", paid_now)
    # 2. Поза годинами платного паркування: оплата не вимагається, жодних висновків
    if not paid_now:
        return ScanResult("unknown", paid_now=False)

    sessions = db.scalars(select(ParkingSession).where(ParkingSession.plate_hmac == plate_hmac)).all()
    here = [s for s in sessions if s.lot_id == lot.id]

    # 3. Активна сесія на ЦЬОМУ лоті
    if any(s.ended_at is None for s in here):
        return ScanResult("active", True)

    # 4. Сесію на цьому лоті закрито t хв тому
    closed = [clock.from_db(s.ended_at) for s in here if s.ended_at is not None]
    if closed:
        t = int((now - max(closed)).total_seconds() // 60)
        if t <= grace:
            return ScanResult("active", True, minutes_since_close=t, grace_after_close=True)
        if t <= window:
            return ScanResult("closed_but_present", True, minutes_since_close=t)

    # 5–6. Не сплачено; сесія на іншому лоті лише позначається
    other = any(s.lot_id != lot.id and s.ended_at is None for s in sessions)
    return ScanResult("unpaid", True, session_on_other_lot=other, recheck_after_min=grace)
