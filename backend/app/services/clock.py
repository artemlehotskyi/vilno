"""Демо-годинник. Час тільки серверний: now() = реальний час + offset із demo_state.
Клієнтський час не приймаємо ніде. Параметр `real` потрібен лише тестам."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.config import settings
from app.models.demo_state import DemoState

KYIV = ZoneInfo("Europe/Kyiv")
UTC = timezone.utc


def real_now() -> datetime:
    return datetime.now(UTC)


def to_db(dt: datetime) -> datetime:
    """aware → наївний UTC (так зберігаємо в SQLite)."""
    return dt.astimezone(UTC).replace(tzinfo=None)


def from_db(dt: datetime) -> datetime:
    """наївний UTC з БД → aware Europe/Kyiv."""
    return dt.replace(tzinfo=UTC).astimezone(KYIV)


def _state(db: Session, real: datetime | None = None) -> DemoState:
    st = db.get(DemoState, 1)
    if st is None:
        # перше звернення: годинник стартує з DEMO_CLOCK_START
        start = datetime.fromisoformat(settings.DEMO_CLOCK_START)
        st = DemoState(id=1, clock_offset_seconds=(start - (real or real_now())).total_seconds())
        db.add(st)
        db.commit()
    return st


def now(db: Session, real: datetime | None = None) -> datetime:
    st = _state(db, real)
    return ((real or real_now()) + timedelta(seconds=st.clock_offset_seconds)).astimezone(KYIV)


def set_clock(db: Session, target: datetime, real: datetime | None = None) -> datetime:
    if target.tzinfo is None:
        raise ValueError("потрібен час із часовою зоною")
    st = _state(db, real)
    st.clock_offset_seconds = (target - (real or real_now())).total_seconds()
    db.commit()
    return now(db, real)


def advance(db: Session, minutes: float, real: datetime | None = None) -> datetime:
    st = _state(db, real)
    st.clock_offset_seconds += minutes * 60
    db.commit()
    return now(db, real)


def reset(db: Session, real: datetime | None = None) -> datetime:
    return set_clock(db, datetime.fromisoformat(settings.DEMO_CLOCK_START), real)


def floor_minute(dt: datetime) -> datetime:
    """Тарифікація йде по хвилинах за годинником: секунди відкидаємо (початок і кінець вниз).
    Без цього реальний час, що тече між «+90 хв» і «фініш», дав би 91 хв замість 90."""
    return dt.replace(second=0, microsecond=0)
