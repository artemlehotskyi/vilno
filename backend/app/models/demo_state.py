from sqlalchemy import Float, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class DemoState(Base):
    """Один рядок (id=1): зсув демо-годинника відносно реального часу, секунди.
    Зберігаємо в БД, щоб зсув пережив перезапуск сервера."""

    __tablename__ = "demo_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    clock_offset_seconds: Mapped[float] = mapped_column(Float, default=0.0)
