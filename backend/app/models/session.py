from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ParkingSession(Base):
    """Сесія паркування. Номер лише як HMAC. Часи — наївний UTC (див. services.clock.to_db/from_db)."""

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # uuid4
    plate_hmac: Mapped[str] = mapped_column(String(64), index=True)
    lot_id: Mapped[int] = mapped_column(Integer, ForeignKey("lots.id"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    amount_uah: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String)  # active / finished / paid
    payment_ref: Mapped[str | None] = mapped_column(String, nullable=True)
