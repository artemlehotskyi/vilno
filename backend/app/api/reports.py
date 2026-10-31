from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Lot
from app.services import clock, reports
from app.services.plate import normalize

router = APIRouter(prefix="/api")


class ReportIn(BaseModel):
    lot_id: int
    plate: str | None = None
    client_id: str = Field(min_length=8, max_length=128)  # анонімний id з localStorage


class ReportOut(BaseModel):
    ok: Literal[True] = True  # ЗАВЖДИ однаково: ні статусу оплати, ні результату звірки, ні ліміту


@router.post("/reports", response_model=ReportOut)
def create_report(body: ReportIn, db: Session = Depends(get_db)):
    lot = db.get(Lot, body.lot_id)
    if lot is None:
        raise HTTPException(404, "майданчик не знайдено")
    plate = None
    if body.plate:  # перевіряємо лише формат: це не розкриває нічого про оплату
        plate = normalize(body.plate)
        if plate is None:
            raise HTTPException(422, "номер має формат AA 1234 BB")
    reports.submit(db, lot, plate, body.client_id, clock.now(db))
    return ReportOut()
