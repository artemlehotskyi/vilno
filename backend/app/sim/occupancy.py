"""Симульована зайнятість майданчика. СИМУЛЯЦІЯ, не реальні дані.
Фіксована за SIM_SEED і lot.id, тож числа на демо не стрибають між перезапусками.
Профіль (середнє, розкид, стеля) задається SIM_OCC_* у конфігу: це припущення, не вимір."""
import random

from app.config import settings

# Припущення (ABOUT §8.1): ~60% зайнятості в середньому по місцях. Центр гаусіани SIM_OCC_MEAN вищий,
# бо значення обрізаються стелею; зважене середнє по місцях лишається ≈ 60%.
MEAN_OCCUPANCY = 0.6
MIN_OCCUPANCY = 0.2


def occupancy(lot_id: int, seed: int) -> float:
    rng = random.Random(f"{seed}:{lot_id}")
    raw = rng.gauss(settings.SIM_OCC_MEAN, settings.SIM_OCC_SPREAD)
    return min(settings.SIM_OCC_MAX, max(MIN_OCCUPANCY, raw))


def simulated_busy(lot_id: int, places: int | None, seed: int) -> int | None:
    if places is None:
        return None
    return round(places * occupancy(lot_id, seed))
