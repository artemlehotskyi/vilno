"""CSV data.gov.ua → SQLite. Ідемпотентно: повторний запуск оновлює, а не дублює."""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.db import SessionLocal, init_db  # noqa: E402
from app.models import Lot  # noqa: E402
from app.services.lots_import import import_lots  # noqa: E402
from streets import build_cache  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-streets", action="store_true", help="не чіпати кеш геометрії вулиць (без мережі)")
    ap.add_argument("--refresh-streets", action="store_true", help="перекачати геометрію всіх вулиць з OSM")
    args = ap.parse_args()
    init_db()
    with SessionLocal() as db:
        n = import_lots(db)
        lots = db.query(Lot).all()
    paid = [x for x in lots if x.is_paid]
    print(f"імпортовано {n} майданчиків у БД: {len(lots)} (платних {len(paid)}, безкоштовних {len(lots) - len(paid)})")
    print(f"місць на платних: {sum(x.places or 0 for x in paid)}")
    if not args.no_streets:
        done, failed = build_cache(lots, refresh=args.refresh_streets)
        print(f"вулиці OSM → data/processed/streets.json: оновлено {done}, помилок {failed}")


if __name__ == "__main__":
    main()
