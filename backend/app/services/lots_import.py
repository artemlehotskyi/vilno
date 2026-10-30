"""Імпорт майданчиків з data/raw/parkinglots_2025-03-27.csv (data.gov.ua, Чернівецька міська рада).

Чистка за DATA.md §1.4: strip, 'null' → None, рядок #38 (lat і lon в одному полі),
рядки #65–66 (координат немає → data/geo_overrides.json).
Майданчик = групування за адресою + оператором. Імпорт ідемпотентний (merge за id).
"""
import csv
import json
from collections import defaultdict
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import ROOT
from app.models import Lot

CSV_PATH = ROOT / "data" / "raw" / "parkinglots_2025-03-27.csv"
OVERRIDES_PATH = ROOT / "data" / "geo_overrides.json"
SOURCE = "data.gov.ua:parkinglots_2025-03-27"

# Припущення (DATA.md §3): зони виводимо з ціни, в наборі їх немає.
CENTER_MIN_PRICE = 20.0
STANDARD_MIN_PRICE = 10.0

# Межі Чернівців: страховка від хибних координат у наборі
LAT_RANGE = (48.2, 48.4)
LON_RANGE = (25.8, 26.1)


def _n(value: str | None) -> str | None:
    if value is None:
        return None
    v = value.strip()
    return None if v in ("", "null") else v


def zone_for(price: float | None) -> str | None:
    if price is None:
        return None
    if price >= CENTER_MIN_PRICE:
        return "center"
    if price >= STANDARD_MIN_PRICE:
        return "standard"
    return "market"


def parse_hours(value: str | None) -> dict | None:
    """'1,2,3,4,5; 09:00-19:00' → {"days": [1..5], "from": "09:00", "to": "19:00"}"""
    v = _n(value)
    if not v:
        return None
    days, span = v.split(";")
    start, end = span.strip().split("-")
    return {"days": [int(d) for d in days.split(",")], "from": start.strip(), "to": end.strip()}


def _coords(row: dict, overrides: dict) -> tuple[float, float, str | None] | None:
    lat, lon = _n(row["geoCoordinatesLatitude"]), _n(row["geoCoordinatesLongitude"])
    fix = None
    if lat and "," in lat:  # рядок #38: "lat, lon" в одному полі
        lat, lon_in_lat = (p.strip() for p in lat.split(",", 1))
        lon = lon or lon_in_lat
        fix = "split_field"
    if lat and lon:
        return float(lat), float(lon), fix
    ov = overrides.get(row["identifier"])
    if ov:
        return float(ov["lat"]), float(ov["lon"]), "geocoded"
    return None


def read_rows(csv_path: Path = CSV_PATH) -> list[dict]:
    with open(csv_path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def load_overrides(path: Path = OVERRIDES_PATH) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8")).get("rows", {})


def _sum_or_none(values: list[str | None]) -> int | None:
    # сума лише якщо відомі всі рядки групи, інакше місткість невідома
    if not values or any(v is None for v in values):
        return None
    return int(sum(float(v) for v in values))


def build_lots(rows: list[dict], overrides: dict) -> list[dict]:
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for r in rows:
        key = (_n(r["addressThoroughfare"]), _n(r["addressLocatorDesignator"]),
               _n(r["addressLocatorBuilding"]), _n(r["operatorName"]))
        groups[key].append(r)

    lots = []
    for (street, number, letter, operator), grp in groups.items():
        ids = sorted(int(r["identifier"]) for r in grp)

        points, fixes = [], []
        for r in grp:
            c = _coords(r, overrides)
            if c is None:
                raise ValueError(f"немає координат для identifier={r['identifier']} (додай у data/geo_overrides.json)")
            lat, lon, fix = c
            if not (LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LON_RANGE[0] <= lon <= LON_RANGE[1]):
                raise ValueError(f"координати поза Чернівцями: identifier={r['identifier']} ({lat}, {lon})")
            points.append([lat, lon])
            if fix:
                fixes.append(fix)

        prices = {_n(r["price"]) for r in grp}
        hours = {_n(r["openingHours"]) for r in grp}
        if len(prices) > 1 or len(hours) > 1:
            raise ValueError(f"різні ціни/години в одній групі {street} {number}: {prices} {hours}")
        price = float(prices.pop()) if prices != {None} else None
        is_free = operator == "вільна"

        address = street or ""
        if number:
            address += f", {number}{letter or ''}"
        descriptions = []
        for r in grp:
            d = _n(r["addressDescription"])
            if d and d not in descriptions:
                descriptions.append(d)

        lots.append({
            "id": ids[0],
            "source_ids": ids,
            "source": SOURCE,
            "address": address,
            "description": "; ".join(descriptions) or None,
            "operator_name": None if is_free else operator,
            "operator_code": next((c for c in (_n(r["operatorIdentifier"]) for r in grp) if c), None),
            "is_paid": price is not None,
            "zone": zone_for(price),
            "tariff_per_hour": price,
            "places": _sum_or_none([_n(r["lotQuantity"]) for r in grp]),
            "places_disabled": _sum_or_none([_n(r["lotQuantityDisabled"]) for r in grp]),
            "opening_hours": parse_hours(hours.pop()),
            "lat": sum(p[0] for p in points) / len(points),
            "lon": sum(p[1] for p in points) / len(points),
            "points": points,
            "geo_fixed": fixes[0] if fixes else None,
        })
    return sorted(lots, key=lambda x: x["id"])


def import_lots(db: Session, csv_path: Path = CSV_PATH, overrides_path: Path = OVERRIDES_PATH) -> int:
    lots = build_lots(read_rows(csv_path), load_overrides(overrides_path))
    for data in lots:
        db.merge(Lot(**data))
    db.commit()
    return len(lots)
