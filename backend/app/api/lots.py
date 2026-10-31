import json

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import ROOT, settings
from app.db import get_db
from app.models import Lot, ParkingSession
from app.services import clock
from app.services.tariff import is_open_at
from app.sim.occupancy import simulated_busy

router = APIRouter(prefix="/api")

# Кеш геометрії вулиць збирає scripts/import_lots.py з OSM; у рантаймі мережа не потрібна
STREETS_PATH = ROOT / "data" / "processed" / "streets.json"


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
    # Серверний час: чи діє зараз платне паркування (поза годинами безкоштовно). None для безкоштовних лотів
    open_now: bool | None = None


def to_out(lot: Lot, now, active: int = 0) -> LotOut:
    out = LotOut.model_validate(lot)
    if lot.is_paid:
        out.open_now = is_open_at(lot.opening_hours, now)  # для безкоштовних місткість невідома майже всюди, оцінку не даємо
        out.sim_busy = simulated_busy(lot.id, lot.places, settings.SIM_SEED)
        if out.sim_busy is not None:
            out.free_estimate = max(0, lot.places - out.sim_busy - active)  # мінус реальні активні сесії
    return out


@router.get("/lots", response_model=list[LotOut])
def list_lots(db: Session = Depends(get_db)):
    active = dict(db.execute(
        select(ParkingSession.lot_id, func.count()).where(ParkingSession.status == "active").group_by(ParkingSession.lot_id)
    ).all())
    now = clock.now(db)
    return [to_out(x, now, active.get(x.id, 0)) for x in db.scalars(select(Lot).order_by(Lot.id))]


@router.get("/lots/{lot_id}", response_model=LotOut)
def get_lot(lot_id: int = Path(ge=1, le=2_147_483_647), db: Session = Depends(get_db)):
    lot = db.get(Lot, lot_id)
    if lot is None:
        raise HTTPException(404, "майданчик не знайдено")
    active = db.scalar(select(func.count()).select_from(ParkingSession).where(
        ParkingSession.lot_id == lot_id, ParkingSession.status == "active"))
    return to_out(lot, clock.now(db), active or 0)


@router.get("/streets")
def streets():
    """Ділянки вулиць майданчиків (OSM, кеш імпорту). Немає кешу → {}: фронт малює лінію через точки лота."""
    if not STREETS_PATH.exists():
        return {}
    return json.loads(STREETS_PATH.read_text(encoding="utf-8"))
