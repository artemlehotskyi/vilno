"""Симуляція неоплати й вигоди виїзду інспектора (ABOUT §6.1). СИМУЛЯЦІЯ, не реальні дані.
Усе фіксоване за SIM_SEED і lot.id: числа на демо не стрибають. Середні значення — припущення
з прикладу ABOUT §6.2 (центр 35%, решта нижче). Реальних даних про неоплату в Чернівцях немає."""
import random

from app.config import settings

UNPAID_MEAN = {"center": 0.35, "standard": 0.20, "market": 0.15}  # припущення
CONCENTRATION = 8      # Beta(m*k, (1-m)*k): середнє m, розкид між майданчиками
FINE_MULTIPLIER = 20   # ст. 152-1 КУпАП: штраф = 20 × вартість години


def unpaid_share(lot_id: int, zone: str, seed: int) -> float:
    m = UNPAID_MEAN[zone]
    return random.Random(f"{seed}:unpaid:{lot_id}").betavariate(m * CONCENTRATION, (1 - m) * CONCENTRATION)


def expected_benefit(cars: int, share: float, tariff: float,
                     fine_prob: float | None = None) -> float:
    """вигода = авто × частка неоплати × штраф × ймовірність сплати штрафу."""
    p = settings.FINE_PAYMENT_PROB if fine_prob is None else fine_prob
    return cars * share * (FINE_MULTIPLIER * tariff) * p


def decide(benefit: float, trip_cost: float | None = None) -> str:
    """'go' — їхати окремо; 'route' — лише в складі маршруту."""
    cost = settings.TRIP_COST_UAH if trip_cost is None else trip_cost
    return "go" if benefit > cost else "route"
