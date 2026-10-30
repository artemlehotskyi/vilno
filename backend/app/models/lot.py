from sqlalchemy import JSON, Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Lot(Base):
    """Майданчик = група рядків набору data.gov.ua з однаковими адресою й оператором.
    id = мінімальний identifier рядка набору, тож повторний імпорт не змінює id."""

    __tablename__ = "lots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    source_ids: Mapped[list] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String)
    address: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    operator_name: Mapped[str | None] = mapped_column(String, nullable=True)
    operator_code: Mapped[str | None] = mapped_column(String, nullable=True)
    is_paid: Mapped[bool] = mapped_column(Boolean)
    zone: Mapped[str | None] = mapped_column(String, nullable=True)  # center / standard / market (припущення)
    tariff_per_hour: Mapped[float | None] = mapped_column(Float, nullable=True)
    places: Mapped[int | None] = mapped_column(Integer, nullable=True)
    places_disabled: Mapped[int | None] = mapped_column(Integer, nullable=True)
    opening_hours: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {"days":[1..7],"from":"09:00","to":"19:00"}
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    points: Mapped[list] = mapped_column(JSON)  # [[lat, lon], ...] усіх рядків групи
    geo_fixed: Mapped[str | None] = mapped_column(String, nullable=True)  # split_field / geocoded
