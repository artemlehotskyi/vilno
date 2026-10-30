from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import demo, lots, scans, sessions, stats
from app.db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="VILNO", lifespan=lifespan)
app.include_router(lots.router)
app.include_router(sessions.router)
app.include_router(scans.router)
app.include_router(stats.router)
app.include_router(demo.router)


@app.get("/api/health")
def health():
    return {"ok": True}
