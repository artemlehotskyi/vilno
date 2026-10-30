from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Scan(Base):
    """Скан інспектора. Номер лише як HMAC (NULL, якщо номер не підтверджено)."""

    __tablename__ = "scans"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # uuid4
    lot_id: Mapped[int] = mapped_column(Integer, ForeignKey("lots.id"), index=True)
    plate_hmac: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String)  # active / unpaid / closed_but_present / unknown
    ocr_source: Mapped[str] = mapped_column(String)  # manual / cv
    scanned_at: Mapped[datetime] = mapped_column(DateTime)  # наївний UTC
