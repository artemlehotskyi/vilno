from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Lot

router = APIRouter(prefix="/api")


class LotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_ids: list[int]
    source: str
    address: str
    description: str | None
    operator_name: str | None
    operator_code: str | None
    is_paid: bool
    zone: str | None
    tariff_per_hour: float | None
    places: int | None
    places_disabled: int | None
    opening_hours: dict | None
    lat: float
    lon: float
    points: list[list[float]]
    geo_fixed: str | None


@router.get("/lots", response_model=list[LotOut])
def list_lots(db: Session = Depends(get_db)):
    return db.scalars(select(Lot).order_by(Lot.id)).all()


@router.get("/lots/{lot_id}", response_model=LotOut)
def get_lot(lot_id: int, db: Session = Depends(get_db)):
    lot = db.get(Lot, lot_id)
    if lot is None:
        raise HTTPException(404, "майданчик не знайдено")
    return lot
