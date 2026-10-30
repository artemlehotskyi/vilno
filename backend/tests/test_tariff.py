"""11 тест-кейсів з ARCHITECTURE §5.1. Пн = 26.10.2026, Пт = 30.10, Сб = 31.10."""
from datetime import datetime

import pytest

from app.services.clock import KYIV
from app.services.tariff import amount, quote

MS = {"days": [1, 2, 3, 4, 5], "from": "09:00", "to": "19:00"}      # МіськШЕП: Пн–Пт 09–19
ALL_DAY = {"days": [1, 2, 3, 4, 5, 6, 7], "from": "00:00", "to": "24:00"}
MARKET = {"days": [1, 2, 3, 4, 5, 6, 7], "from": "09:00", "to": "18:00"}


def t(day: int, hh: int, mm: int = 0, month: int = 10) -> datetime:
    return datetime(2026, month, day, hh, mm, tzinfo=KYIV)


MON, TUE, SAT = 26, 27, 31


def test_01_center_9_minutes():
    assert amount(t(MON, 10), t(MON, 10, 9), 20, "center", MS) == 3.00


def test_02_center_1h30():
    assert amount(t(MON, 10), t(MON, 11, 30), 20, "center", MS) == 30.00


def test_03_center_no_cap():
    assert amount(t(MON, 10), t(MON, 14), 20, "center", MS) == 80.00


def test_04_center_after_closing_is_free():
    assert amount(t(MON, 18), t(MON, 20), 20, "center", MS) == 20.00  # 19–20 безкоштовно


def test_05_center_weekend_is_free():
    assert amount(t(SAT, 10), t(SAT, 12), 20, "center", MS) == 0.00


def test_06_standard_1h30():
    assert amount(t(MON, 10), t(MON, 11, 30), 10, "standard", MS) == 15.00


def test_07_standard_cap_reached():
    assert amount(t(MON, 10), t(MON, 13), 10, "standard", MS) == 30.00


def test_08_standard_cap_holds_all_day():
    assert amount(t(MON, 10), t(MON, 17), 10, "standard", MS) == 30.00


def test_09_standard_tariff_15():
    assert amount(t(MON, 10), t(MON, 11, 30), 15, "standard", MS) == 22.50


def test_10_standard_24_7_cap_per_day():
    q = quote(t(MON, 20), t(TUE, 10), 10, "standard", ALL_DAY)
    assert q.total == 60.00                       # 30 + 30: ліміт діє окремо на кожну добу
    assert [p.amount for p in q.days] == [30.00, 30.00]
    assert all(p.capped for p in q.days)


def test_11_market_has_no_cap():
    assert amount(t(MON, 10), t(MON, 16), 5, "market", MARKET) == 30.00


# --- додатково: межі та розбивка для UI ---

def test_minutes_are_rounded_up():
    assert amount(t(MON, 10), t(MON, 10, 0).replace(second=1), 20, "center", MS) == 0.33  # 1 с → 1 хв → 20/60


def test_zero_length_session_is_free():
    assert amount(t(MON, 10), t(MON, 10), 20, "center", MS) == 0.00


def test_session_before_opening_counts_from_opening():
    assert amount(t(MON, 8), t(MON, 10), 20, "center", MS) == 20.00  # лише 09–10


def test_breakdown_shows_cap():
    q = quote(t(MON, 10), t(MON, 14), 10, "standard", MS)
    p = q.days[0]
    assert (p.minutes, p.raw, p.amount, p.cap, p.capped) == (240, 40.00, 30.00, 30.00, True)
    assert q.minutes == 240


def test_no_opening_hours_means_always_open():
    assert amount(t(MON, 22), t(TUE, 2), 10, None, None) == 40.00


def test_end_before_start_raises():
    with pytest.raises(ValueError):
        amount(t(MON, 11), t(MON, 10), 20, "center", MS)
