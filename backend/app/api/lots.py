from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import Lot
from app.sim.occupancy import simulated_busy

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
    # СИМУЛЯЦІЯ: зайнятість із SIM_SEED. Вільні = місць − симульовані зайняті (оцінка)
    sim_busy: int | None = None
    free_estimate: int | None = None


def to_out(lot: Lot) -> LotOut:
    out = LotOut.model_validate(lot)
    if lot.is_paid:  # для безкоштовних місткість невідома майже всюди, оцінку не даємо
        out.sim_busy = simulated_busy(lot.id, lot.places, settings.SIM_SEED)
        if out.sim_busy is not None:
            out.free_estimate = max(0, lot.places - out.sim_busy)
    return out


@router.get("/lots", response_model=list[LotOut])
def list_lots(db: Session = Depends(get_db)):
    return [to_out(x) for x in db.scalars(select(Lot).order_by(Lot.id))]


@router.get("/lots/{lot_id}", response_model=LotOut)
def get_lot(lot_id: int, db: Session = Depends(get_db)):
    lot = db.get(Lot, lot_id)
    if lot is None:
        raise HTTPException(404, "майданчик не знайдено")
    return to_out(lot)
