import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import demo, lots, recognize, scans, sessions, stats
from app.config import settings
from app.db import init_db
from app.services import cv


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    if settings.CV_ENABLED:  # моделі вантажаться один раз на старті процесу
        try:
            await asyncio.to_thread(cv.load_models)
        except Exception:
            logging.getLogger("vilno.cv").exception("CV не завантажено: лишається ручний ввід")
    yield


app = FastAPI(title="VILNO", lifespan=lifespan)
app.include_router(lots.router)
app.include_router(sessions.router)
app.include_router(scans.router)
app.include_router(stats.router)
app.include_router(recognize.router)
app.include_router(demo.router)


@app.get("/api/health")
def health():
    return {"ok": True}
