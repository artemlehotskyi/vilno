from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import lots
from app.db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="VILNO", lifespan=lifespan)
app.include_router(lots.router)


@app.get("/api/health")
def health():
    return {"ok": True}
