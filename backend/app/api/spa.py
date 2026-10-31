"""Статика зібраного фронту (frontend/dist) + SPA-fallback на index.html для /driver, /inspector, /city.
Підключається ОСТАННІМ, після всіх /api-роутерів. Невідомий /api/* лишається JSON 404."""
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import settings

router = APIRouter(include_in_schema=False)


def _dist() -> Path:
    return Path(settings.FRONTEND_DIST).resolve()


@router.get("/{path:path}")
def frontend(path: str):
    if path == "api" or path.startswith("api/"):
        raise HTTPException(404, "немає такого ендпоінту")
    dist = _dist()
    index = dist / "index.html"
    if not index.is_file():
        raise HTTPException(404, "фронт не зібрано (npm run build)")
    if path:
        f = (dist / path).resolve()
        if f.is_file() and dist in f.parents:  # захист від ../
            # хешовані файли Vite можна кешувати назавжди
            cache = "public, max-age=31536000, immutable" if f.parent.name == "assets" else "no-cache"
            return FileResponse(f, headers={"Cache-Control": cache})
    return FileResponse(index, headers={"Cache-Control": "no-cache"})
