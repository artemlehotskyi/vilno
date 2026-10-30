from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.api.deps import require_demo_token
from app.db import get_db
from app.models import ParkingSession
from app.services import clock

router = APIRouter(prefix="/api")


class ClockOut(BaseModel):
    now: datetime  # демо-час (Europe/Kyiv)
    is_demo_shifted: bool


class ClockIn(BaseModel):
    set: datetime | None = None
    advance_minutes: float | None = None


def _out(db: Session) -> ClockOut:
    shifted = abs(clock._state(db).clock_offset_seconds) > 1
    return ClockOut(now=clock.now(db), is_demo_shifted=shifted)


@router.get("/clock", response_model=ClockOut)
def get_clock(db: Session = Depends(get_db)):
    return _out(db)


@router.post("/demo/clock", response_model=ClockOut, dependencies=[Depends(require_demo_token)])
def set_demo_clock(body: ClockIn, db: Session = Depends(get_db)):
    if (body.set is None) == (body.advance_minutes is None):
        raise HTTPException(422, "вкажіть рівно одне: set або advance_minutes")
    if body.set is not None:
        if body.set.tzinfo is None:
            raise HTTPException(422, "set має містити часову зону, напр. 2026-10-30T14:00:00+02:00")
        clock.set_clock(db, body.set)
    else:
        clock.advance(db, body.advance_minutes)
    return _out(db)


@router.post("/demo/reset", response_model=ClockOut, dependencies=[Depends(require_demo_token)])
def reset_demo(db: Session = Depends(get_db)):
    """Скидає годинник на DEMO_CLOCK_START і видаляє всі демо-сесії (і скани, коли з'являться)."""
    db.execute(delete(ParkingSession))
    db.commit()
    clock.reset(db)
    return _out(db)
