import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.config import settings
from app.db import Base, get_db
from app.main import app
from app.services.lots_import import import_lots


@pytest.fixture()
def engine():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture()
def SessionMaker(engine):
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def client(SessionMaker):
    """API на in-memory БД із імпортованими лотами. Без `with` — lifespan не чіпає справжню vilno.db."""
    with SessionMaker() as db:
        import_lots(db)

    def override():
        with SessionMaker() as db:
            yield db

    app.dependency_overrides[get_db] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def test_secrets(monkeypatch):
    """Тести не залежать від справжніх секретів із .env."""
    monkeypatch.setattr(settings, "PLATE_HMAC_KEY", "test-hmac-key")
    monkeypatch.setattr(settings, "DEMO_TOKEN", "test-token")
    monkeypatch.setattr(settings, "DEMO_CLOCK_START", "2026-10-30T14:00:00+02:00")
