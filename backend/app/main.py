from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="VILNO", lifespan=lifespan)


@app.get("/api/health")
def health():
    return {"ok": True}
