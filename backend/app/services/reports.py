"""Скарги «місць насправді немає» (C5). Лише сигнал для диспетчера.

Навмисно:
- клієнт ЗАВЖДИ отримує однакову відповідь, без результату звірки й статусу оплати,
  інакше застосунок став би інструментом перевірки чужих номерів;
- скарга не змінює статус скану і не створює штраф (scan_status її не читає);
- ліміт: одна скарга з одного анонімного клієнта на лот раз на REPORT_COOLDOWN_MIN.
"""
import hashlib
import hmac
import uuid
from datetime import datetime, timedelta

from sqlalchemy import Integer, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Lot, ParkingSession, Report
from app.services import clock
from app.services.plate import plate_hmac

SIGNAL_WINDOW = timedelta(hours=1)


def client_hmac(client_id: str) -> str:
    key = settings.PLATE_HMAC_KEY.encode()
    return hmac.new(key, f"client:{client_id}".encode(), hashlib.sha256).hexdigest()


def submit(db: Session, lot: Lot, plate: str | None, client_id: str, now: datetime) -> bool:
    """Повертає True, якщо скаргу збережено (False — спрацював ліміт). Клієнту це НЕ повідомляється."""
    ch = client_hmac(client_id)
    since = clock.to_db(now - timedelta(minutes=settings.REPORT_COOLDOWN_MIN))
    recent = db.scalar(select(func.count()).select_from(Report).where(
        Report.client_hmac == ch, Report.lot_id == lot.id, Report.created_at > since))
    if recent:
        return False

    ph = plate_hmac(plate) if plate else None
    confirmed = None
    if ph is not None:
        has_active = db.scalar(select(func.count()).select_from(ParkingSession).where(
            ParkingSession.plate_hmac == ph, ParkingSession.lot_id == lot.id, ParkingSession.ended_at.is_(None)))
        confirmed = not has_active
    db.add(Report(id=str(uuid.uuid4()), lot_id=lot.id, client_hmac=ch, plate_hmac=ph,
                  confirmed=confirmed, created_at=clock.to_db(now)))
    db.commit()
    return True


def signals_last_hour(db: Session, now: datetime) -> dict[int, tuple[int, int]]:
    """lot_id → (усього скарг, підтверджених) за останню годину демо-часу. Лише агрегати."""
    since = clock.to_db(now - SIGNAL_WINDOW)
    rows = db.execute(
        select(Report.lot_id, func.count(), func.sum(func.coalesce(Report.confirmed, False).cast(Integer)))
        .where(Report.created_at > since).group_by(Report.lot_id)
    ).all()
    return {lot_id: (total, int(conf or 0)) for lot_id, total, conf in rows}

