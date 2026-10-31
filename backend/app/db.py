"""SQLite + SQLAlchemy. Відносний шлях до БД рахуємо від кореня проєкту,
щоб backend/ і scripts/ працювали з одним файлом."""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import ROOT, settings


def _database_url() -> str:
    url = make_url(settings.DATABASE_URL)
    if url.drivername.startswith("sqlite") and url.database and url.database != ":memory:":
        path = ROOT / url.database
        url = url.set(database=str(path))
    return url.render_as_string(hide_password=False)


engine = create_engine(_database_url(), connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    # моделі імпортуємо тут, щоб вони встигли зареєструватись у Base.metadata
    import app.models  # noqa: F401

    Base.metadata.create_all(engine)
    _add_missing_columns()


def _add_missing_columns() -> None:
    """Мінімальна «міграція» без Alembic: нові nullable-колонки додаємо в наявні таблиці."""
    insp = inspect(engine)
    for table in Base.metadata.sorted_tables:
        if not insp.has_table(table.name):
            continue
        existing = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name not in existing:
                ddl = col.type.compile(engine.dialect)
                with engine.begin() as conn:
                    conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {ddl}'))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
