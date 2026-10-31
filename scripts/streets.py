"""Геометрія вулиць майданчиків з OpenStreetMap (Overpass API) → data/processed/streets.json.
Запускається лише на етапі імпорту (scripts/import_lots.py). Під час роботи застосунку мережа не потрібна:
API віддає готовий кеш. Дані © OpenStreetMap contributors (ODbL), вказані в атрибуції мапи."""
import json
import math
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE_PATH = ROOT / "data" / "processed" / "streets.json"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "vilno-hackathon/1.0 (Chernivtsi Open Data Hackathon 3.0)"  # без User-Agent Overpass віддає 406

SEARCH_RADIUS_M = 200   # де шукаємо way з назвою вулиці навколо майданчика
SEGMENT_RADIUS_M = 220  # лишаємо лише ділянку вулиці біля майданчика, а не всю вулицю

_STOP = {"просп.", "пл.", "площа", "пров.", "вул.", "вулиця", "провулок", "проспект"}


def street_core(address: str) -> str | None:
    """«Незалежності просп., 96» → «Незалежності»; «Кордуби М.» → «Кордуби»; «пров.Ончула» → «Ончула»."""
    head = address.split(",")[0]
    head = re.sub(r"\b(пров|просп|вул|пл)\.", " ", head)  # «пров.Ончула» без пробілу
    words = [w for w in head.split() if w.lower() not in _STOP and not re.fullmatch(r"\w\.", w)]
    core = " ".join(words).strip()
    return core or None


def _dist_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(h))


def _query_city(south: float, west: float, north: float, east: float) -> list[dict]:
    """Один запит на все місто (Overpass повільний, ~20 с на запит): усі іменовані вулиці в bbox майданчиків."""
    q = f'[out:json][timeout:120];way["highway"]["name"]({south},{west},{north},{east});out geom;'
    req = urllib.request.Request(
        OVERPASS_URL, data=urllib.parse.urlencode({"data": q}).encode(),
        headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)["elements"]


def _segments(ways: list[dict], center: tuple[float, float]) -> list[list[list[float]]]:
    """Вузли в радіусі SEGMENT_RADIUS_M від майданчика, розбиті на неперервні ділянки."""
    out: list[list[list[float]]] = []
    for w in ways:
        cur: list[list[float]] = []
        for p in w.get("geometry", []):
            pt = (p["lat"], p["lon"])
            if _dist_m(center, pt) <= SEGMENT_RADIUS_M:
                cur.append([round(pt[0], 6), round(pt[1], 6)])
            else:
                if len(cur) > 1:
                    out.append(cur)
                cur = []
        if len(cur) > 1:
            out.append(cur)
    return out


def match_street(address: str, lat: float, lon: float, points: list[list[float]], city_ways: list[dict]) -> dict:
    """Ділянка вулиці з OSM за назвою й близькістю; не знайдено → лінія через точки майданчика (source='points')."""
    core = street_core(address)
    if core:
        needle = core.lower()

        def nearest(w: dict) -> float:
            return min((_dist_m((lat, lon), (p["lat"], p["lon"])) for p in w.get("geometry", [])), default=1e9)

        ways = [w for w in city_ways if needle in w["tags"]["name"].lower() and nearest(w) <= SEARCH_RADIUS_M]
        if ways:
            # якщо збіглося кілька вулиць (напр. «Головна вулиця» і «Головна Лінія»), беремо найближчу за назвою
            name = min(ways, key=nearest)["tags"]["name"]
            lines = _segments([w for w in ways if w["tags"]["name"] == name], (lat, lon))
            if lines:
                return {"source": "osm", "name": name, "lines": lines}
    distinct = {tuple(p) for p in points}
    lines = [[list(p) for p in points]] if len(distinct) > 1 else []
    return {"source": "points", "name": None, "lines": lines}


def load_cache(path: Path = CACHE_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def build_cache(lots, refresh: bool = False, path: Path = CACHE_PATH) -> tuple[int, int]:
    """Докачує відсутні майданчики (або всі з refresh) одним запитом до Overpass.
    Помилка мережі = пропуск, повтор при наступному запуску. Повертає (оновлено, помилок)."""
    cache = load_cache(path)
    todo = [x for x in lots if refresh or str(x.id) not in cache]
    if not todo:
        return 0, 0
    pad = 0.004  # ≈ 450 м навколо крайніх майданчиків
    try:
        city_ways = _query_city(
            min(x.lat for x in todo) - pad, min(x.lon for x in todo) - pad,
            max(x.lat for x in todo) + pad, max(x.lon for x in todo) + pad,
        )
    except Exception as e:  # мережа/Overpass: не валимо імпорт
        print(f"  вулиці OSM недоступні: {e}")
        return 0, len(todo)
    for lot in todo:
        cache[str(lot.id)] = match_street(lot.address, lot.lat, lot.lon, lot.points, city_ways)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return len(todo), 0
