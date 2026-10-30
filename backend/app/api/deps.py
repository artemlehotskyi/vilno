import secrets

from fastapi import Header, HTTPException

from app.config import settings


def require_demo_token(x_demo_token: str | None = Header(default=None)) -> None:
    """/demo/* лише з заголовком X-Demo-Token = DEMO_TOKEN. Порожній DEMO_TOKEN у .env → завжди 403."""
    expected = settings.DEMO_TOKEN
    if not expected or not x_demo_token or not secrets.compare_digest(x_demo_token, expected):
        raise HTTPException(403, "потрібен заголовок X-Demo-Token")
