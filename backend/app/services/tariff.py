"""Тарифікація за хвилини (ARCHITECTURE §5.1, правила з PLAN §0).

Для кожної календарної доби, яку перетинає сесія:
  хвилини = перетин сесії з openingHours лоту (поза годинами безкоштовно),
  сума доби = тариф × ceil(хвилин) / 60, зі стелею «денного ліміту», якщо він є для зони.
Ліміт денний: 3 × тариф для зони standard; center і market без ліміту (припущення, DATA §3).
"""
import math
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal

# Множник денного ліміту за зоною. None = без ліміту.
ZONE_CAP_MULTIPLIER: dict[str, int | None] = {"center": None, "standard": 3, "market": None}

CENT = Decimal("0.01")


@dataclass(frozen=True)
class DayPart:
    day: date
    minutes: int          # оплачувані хвилини цієї доби (в межах годин роботи)
    raw: float            # сума без ліміту
    amount: float         # сума після ліміту
    cap: float | None     # денний ліміт, грн (None = немає)
    capped: bool


@dataclass(frozen=True)
class Quote:
    total: float
    minutes: int          # усього оплачуваних хвилин
    days: list[DayPart]


def _money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def _at(day: date, hhmm: str, tz) -> datetime:
    if hhmm == "24:00":
        return datetime.combine(day + timedelta(days=1), time(0, 0), tzinfo=tz)
    h, m = hhmm.split(":")
    return datetime.combine(day, time(int(h), int(m)), tzinfo=tz)


def quote(start: datetime, end: datetime, tariff_per_hour: float, zone: str | None,
          opening_hours: dict | None) -> Quote:
    """start/end — aware datetime в одній часовій зоні (Europe/Kyiv).
    opening_hours=None трактуємо як «завжди відкрито»."""
    if end < start:
        raise ValueError("кінець сесії раніше за початок")
    tz = start.tzinfo
    rate = Decimal(str(tariff_per_hour))
    multiplier = ZONE_CAP_MULTIPLIER.get(zone) if zone else None
    cap = _money(rate * multiplier) if multiplier else None

    parts: list[DayPart] = []
    day = start.date()
    while day <= end.date():
        if opening_hours is None:
            open_from, open_to = _at(day, "00:00", tz), _at(day, "24:00", tz)
            is_open_day = True
        else:
            open_from, open_to = _at(day, opening_hours["from"], tz), _at(day, opening_hours["to"], tz)
            is_open_day = day.isoweekday() in opening_hours["days"]

        seconds = 0.0
        if is_open_day:
            seconds = max(0.0, (min(end, open_to) - max(start, open_from)).total_seconds())
        minutes = math.ceil(seconds / 60)
        if minutes:
            raw = _money(rate * minutes / 60)
            amount = min(raw, cap) if cap is not None else raw
            parts.append(DayPart(day, minutes, float(raw), float(amount),
                                 float(cap) if cap is not None else None, amount < raw))
        day += timedelta(days=1)

    total = sum((Decimal(str(p.amount)) for p in parts), Decimal("0"))
    return Quote(float(_money(total)), sum(p.minutes for p in parts), parts)


def amount(start: datetime, end: datetime, tariff_per_hour: float, zone: str | None,
           opening_hours: dict | None) -> float:
    return quote(start, end, tariff_per_hour, zone, opening_hours).total


def is_open_at(opening_hours: dict | None, at: datetime) -> bool:
    """Чи діє платне паркування в момент `at` (aware, Europe/Kyiv). None = завжди."""
    if opening_hours is None:
        return True
    if at.isoweekday() not in opening_hours["days"]:
        return False
    day = at.date()
    return _at(day, opening_hours["from"], at.tzinfo) <= at < _at(day, opening_hours["to"], at.tzinfo)
