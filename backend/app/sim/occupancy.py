"""Симульована зайнятість майданчика. СИМУЛЯЦІЯ, не реальні дані.
Фіксована за SIM_SEED і lot.id, тож числа на демо не стрибають між перезапусками."""
import random

MEAN_OCCUPANCY = 0.6  # припущення (ABOUT §8.1)
SPREAD = 0.15


def occupancy(lot_id: int, seed: int) -> float:
    rng = random.Random(f"{seed}:{lot_id}")
    return min(0.95, max(0.2, rng.gauss(MEAN_OCCUPANCY, SPREAD)))


def simulated_busy(lot_id: int, places: int | None, seed: int) -> int | None:
    if places is None:
        return None
    return round(places * occupancy(lot_id, seed))
