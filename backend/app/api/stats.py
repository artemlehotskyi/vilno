from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import Lot
from app.sim import dispatch
from app.sim.occupancy import MEAN_OCCUPANCY, simulated_busy

router = APIRouter(prefix="/api/stats")


class DispatchRow(BaseModel):
    lot_id: int
    address: str
    operator_name: str | None
    zone: str
    tariff_per_hour: float
    places: int
    cars: int                 # симульована кількість авто
    unpaid_share: float       # симульована частка неоплати
    fine_uah: float           # 20 × тариф
    expected_benefit_uah: float
    decision: str             # go / route


class DispatchOut(BaseModel):
    is_simulated: bool
    assumptions: dict
    go_count: int
    route_count: int
    go_benefit_uah: float
    rows: list[DispatchRow]


@router.get("/dispatch", response_model=DispatchOut)
def get_dispatch(db: Session = Depends(get_db)):
    seed = settings.SIM_SEED
    rows = []
    for lot in db.scalars(select(Lot).where(Lot.is_paid, Lot.places.is_not(None)).order_by(Lot.id)):
        cars = simulated_busy(lot.id, lot.places, seed)
        share = dispatch.unpaid_share(lot.id, lot.zone, seed)
        benefit = dispatch.expected_benefit(cars, share, lot.tariff_per_hour)
        rows.append(DispatchRow(
            lot_id=lot.id, address=lot.address, operator_name=lot.operator_name, zone=lot.zone,
            tariff_per_hour=lot.tariff_per_hour, places=lot.places, cars=cars, unpaid_share=round(share, 4),
            fine_uah=dispatch.FINE_MULTIPLIER * lot.tariff_per_hour,
            expected_benefit_uah=round(benefit, 2), decision=dispatch.decide(benefit),
        ))
    rows.sort(key=lambda r: r.expected_benefit_uah, reverse=True)
    go = [r for r in rows if r.decision == "go"]
    return DispatchOut(
        is_simulated=True,
        assumptions={
            "trip_cost_uah": settings.TRIP_COST_UAH,
            "fine_payment_prob": settings.FINE_PAYMENT_PROB,
            "fine_multiplier": dispatch.FINE_MULTIPLIER,
            "mean_occupancy": MEAN_OCCUPANCY,
            "mean_unpaid_share": dispatch.UNPAID_MEAN,
            "sim_seed": seed,
        },
        go_count=len(go), route_count=len(rows) - len(go),
        go_benefit_uah=round(sum(r.expected_benefit_uah for r in go), 2), rows=rows,
    )
