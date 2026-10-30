import secrets
import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Lot, ParkingSession
from app.services import clock, tariff
from app.services.plate import normalize, plate_hmac

router = APIRouter(prefix="/api/sessions")


class StartIn(BaseModel):
    plate: str
    lot_id: int


class DayOut(BaseModel):
    day: date
    minutes: int
    raw: float
    amount: float
    cap: float | None
    capped: bool


class SessionOut(BaseModel):
    id: str
    lot_id: int
    status: str  # active / finished / paid
    started_at: datetime
    ended_at: datetime | None
    now: datetime  # демо-час сервера
    minutes: int  # оплачувані хвилини (в межах годин роботи)
    amount_uah: float  # active → «поки що», далі остаточна
    is_final: bool
    breakdown: list[DayOut]
    payment_ref: str | None


def _out(db: Session, s: ParkingSession) -> SessionOut:
    lot = db.get(Lot, s.lot_id)
    now = clock.now(db)
    started = clock.from_db(s.started_at)
    ended = clock.from_db(s.ended_at) if s.ended_at else None
    q = tariff.quote(clock.floor_minute(started), clock.floor_minute(ended or now),
                     lot.tariff_per_hour, lot.zone, lot.opening_hours)
    return SessionOut(
        id=s.id, lot_id=s.lot_id, status=s.status, started_at=started, ended_at=ended, now=now,
        minutes=q.minutes, amount_uah=s.amount_uah if s.amount_uah is not None else q.total,
        is_final=s.status != "active", breakdown=[DayOut(**p.__dict__) for p in q.days],
        payment_ref=s.payment_ref,
    )


def _get(db: Session, session_id: str) -> ParkingSession:
    s = db.get(ParkingSession, session_id)
    if s is None:
        raise HTTPException(404, "сесію не знайдено")
    return s


@router.post("", response_model=SessionOut, status_code=201)
def start_session(body: StartIn, db: Session = Depends(get_db)):
    plate = normalize(body.plate)
    if plate is None:
        raise HTTPException(422, "номер має формат AA 1234 BB (літери A B C E H I K M O P T X)")
    lot = db.get(Lot, body.lot_id)
    if lot is None:
        raise HTTPException(404, "майданчик не знайдено")
    if not lot.is_paid:
        raise HTTPException(409, "майданчик безкоштовний: сесія не потрібна")
    h = plate_hmac(plate)
    if db.scalar(select(ParkingSession).where(ParkingSession.plate_hmac == h, ParkingSession.status == "active")):
        raise HTTPException(409, "для цього номера вже є активна сесія")
    s = ParkingSession(id=str(uuid.uuid4()), plate_hmac=h, lot_id=lot.id,
                       started_at=clock.to_db(clock.now(db)), status="active")
    db.add(s)
    db.commit()
    return _out(db, s)


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: str, db: Session = Depends(get_db)):
    return _out(db, _get(db, session_id))


@router.post("/{session_id}/finish", response_model=SessionOut)
def finish_session(session_id: str, db: Session = Depends(get_db)):
    s = _get(db, session_id)
    if s.status != "active":
        raise HTTPException(409, "сесію вже завершено")
    s.ended_at = clock.to_db(clock.now(db))
    s.status = "finished"
    lot = db.get(Lot, s.lot_id)
    s.amount_uah = tariff.amount(clock.floor_minute(clock.from_db(s.started_at)),
                                 clock.floor_minute(clock.from_db(s.ended_at)),
                                 lot.tariff_per_hour, lot.zone, lot.opening_hours)
    db.commit()
    return _out(db, s)


@router.post("/{session_id}/pay", response_model=SessionOut)
def pay_session(session_id: str, db: Session = Depends(get_db)):
    """MOCK-оплата: реальної платіжки немає (Won't). Інтеграція в продукті — LiqPay / Приват24."""
    s = _get(db, session_id)
    if s.status != "finished":
        raise HTTPException(409, "оплата можлива лише після завершення сесії")
    s.status = "paid"
    s.payment_ref = f"MOCK-{secrets.token_hex(4).upper()}"
    db.commit()
    return _out(db, s)
