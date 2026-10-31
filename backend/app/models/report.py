from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Report(Base):
    """Скарга водія «місць насправді немає». Лише сигнал диспетчеру: не змінює статус скану
    і не створює штраф. Номер і id клієнта — тільки як HMAC."""

    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # uuid4
    lot_id: Mapped[int] = mapped_column(Integer, ForeignKey("lots.id"), index=True)
    client_hmac: Mapped[str] = mapped_column(String(64), index=True)
    plate_hmac: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # None — номер не вказано; True — на цьому лоті немає активної сесії з таким номером; False — є
    confirmed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)  # наївний UTC, демо-годинник
