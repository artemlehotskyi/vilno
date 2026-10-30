"""drop + create_all + імпорт лотів. ЗНИЩУЄ всі сесії й скани — запускати лише після підтвердження людини."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.db import Base, SessionLocal, engine, init_db  # noqa: E402
from app.services.lots_import import import_lots  # noqa: E402


def main() -> None:
    import app.models  # noqa: F401

    Base.metadata.drop_all(engine)
    init_db()
    with SessionLocal() as db:
        print(f"БД скинуто, імпортовано {import_lots(db)} майданчиків")


if __name__ == "__main__":
    main()
