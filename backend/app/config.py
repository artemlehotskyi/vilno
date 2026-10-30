"""Конфіг із .env у корені проєкту. Значення секретів ніде не друкуємо."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes")


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///vilno.db")
    PLATE_HMAC_KEY: str = os.getenv("PLATE_HMAC_KEY", "")
    DEMO_TOKEN: str = os.getenv("DEMO_TOKEN", "")

    CV_ENABLED: bool = _bool("CV_ENABLED", True)
    CAR_CONF_MIN: float = float(os.getenv("CAR_CONF_MIN", "0.4"))
    PLATE_CONF_MIN: float = float(os.getenv("PLATE_CONF_MIN", "0.85"))

    # Припущення (підписувати в UI як припущення)
    GRACE_END_MIN: int = int(os.getenv("GRACE_END_MIN", "10"))
    CLOSED_PRESENT_WINDOW_MIN: int = int(os.getenv("CLOSED_PRESENT_WINDOW_MIN", "240"))
    TRIP_COST_UAH: float = float(os.getenv("TRIP_COST_UAH", "200"))
    FINE_PAYMENT_PROB: float = float(os.getenv("FINE_PAYMENT_PROB", "0.63"))

    DEMO_CLOCK_START: str = os.getenv("DEMO_CLOCK_START", "2026-10-30T14:00:00+02:00")
    SIM_SEED: int = int(os.getenv("SIM_SEED", "31102026"))


settings = Settings()
