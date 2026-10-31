import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Lot, Scan
from app.services import clock
from app.services.plate import normalize, plate_hmac
from app.services.scan_status import evaluate

router = APIRouter(prefix="/api")


class ScanIn(BaseModel):
    plate: str | None = Field(default=None, max_length=32)  # None → інспектор не підтвердив номер → unknown
    lot_id: int = Field(ge=1, le=2_147_483_647)
    ocr_source: Literal["manual", "cv"] = "manual"


class ScanOut(BaseModel):
    status: Literal["active", "unpaid", "closed_but_present", "unknown"]
    paid_now: bool
    minutes_since_close: int | None
    grace_after_close: bool
    session_on_other_lot: bool
    recheck_after_min: int | None
    lot_id: int
    scanned_at: datetime


@router.post("/scans", response_model=ScanOut)
def create_scan(body: ScanIn, db: Session = Depends(get_db)):
    lot = db.get(Lot, body.lot_id)
    if lot is None:
        raise HTTPException(404, "майданчик не знайдено")
    h = None
    if body.plate:
        plate = normalize(body.plate)
        if plate is None:
            raise HTTPException(422, "номер має формат AA 1234 BB")
        h = plate_hmac(plate)

    now = clock.now(db)
    r = evaluate(db, h, lot, now)
    if r.paid_now:  # поза годинами скан у журнал не пишемо: нічого перевіряти
        db.add(Scan(id=str(uuid.uuid4()), lot_id=lot.id, plate_hmac=h, status=r.status,
                    ocr_source=body.ocr_source, scanned_at=clock.to_db(now)))
        db.commit()
    return ScanOut(**r.__dict__, lot_id=lot.id, scanned_at=now)
