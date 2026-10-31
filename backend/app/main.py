import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api import demo, lots, recognize, reports, scans, sessions, spa, stats
from app.config import require_secrets, settings
from app.db import SessionLocal, init_db
from app.services import cv


def bootstrap() -> None:
    """Свіжа БД (новий Docker volume): імпортуємо лоти; рядок demo_state створюємо одразу."""
    from sqlalchemy import func, select

    from app.models import Lot
    from app.services import clock
    from app.services.lots_import import import_lots

    with SessionLocal() as db:
        if not db.scalar(select(func.count()).select_from(Lot)):
            n = import_lots(db)
            logging.getLogger("vilno").info("імпортовано %d майданчиків з data.gov.ua", n)
        clock.ensure_state(db)


@asynccontextmanager
async def lifespan(_: FastAPI):
    require_secrets()
    init_db()
    bootstrap()
    if settings.CV_ENABLED:  # моделі вантажаться один раз на старті процесу
        try:
            await asyncio.to_thread(cv.load_models)
        except Exception:
            logging.getLogger("vilno.cv").exception("CV не завантажено: лишається ручний ввід")
    yield


app = FastAPI(title="VILNO", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    """422 без поля `input`: не повторюємо введене (номер) і не падаємо на NaN, який не серіалізується в JSON."""
    errors = [{"loc": list(e.get("loc", ())), "msg": e.get("msg", ""), "type": e.get("type", "")} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errors})
app.include_router(lots.router)
app.include_router(sessions.router)
app.include_router(scans.router)
app.include_router(stats.router)
app.include_router(recognize.router)
app.include_router(reports.router)
app.include_router(demo.router)


@app.get("/api/health")
def health():
    return {"ok": True}


# Останнім: статика фронту + SPA-fallback (не перехоплює /api/*)
app.include_router(spa.router)
