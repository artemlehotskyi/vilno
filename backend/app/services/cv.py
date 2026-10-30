"""Локальне розпізнавання (F8). Жодних зовнішніх API.
  1) «є авто»: pretrained YOLO (COCO, car/truck, conf ≥ CAR_CONF_MIN);
  2) номер: fast-alpr → нормалізація з виправленням OCR за позицією → регулярка.
Невпевнено, не пройшло регулярку або кілька різних кандидатів → plate=None (ручний ввід).
Хибний номер гірший за unknown. Фото обробляємо в пам'яті, не зберігаємо, номер не логуємо."""
import logging
import threading
from dataclasses import dataclass

import cv2
import numpy as np

from app.config import ROOT, settings
from app.services.plate import normalize

log = logging.getLogger("vilno.cv")

MAX_SIDE = 1600
COCO_CAR, COCO_TRUCK = 2, 7
YOLO_WEIGHTS = ROOT / "models" / "yolov8n.pt"  # *.pt у .gitignore; ultralytics докачає при першому запуску

_lock = threading.Lock()  # моделі не потокобезпечні: один виклик за раз
_yolo = None
_alpr = None


class BadImage(ValueError):
    pass


@dataclass
class Recognition:
    enabled: bool
    car_present: bool | None = None   # None — детектор недоступний
    plate: str | None = None          # нормалізований 'AA1234BB' або None
    plate_confidence: float | None = None


def load_models() -> None:
    """Один раз на старті процесу. Якщо fast-alpr не завантажився — лишається тільки крок 1."""
    global _yolo, _alpr
    with _lock:
        if _yolo is None:
            from ultralytics import YOLO
            YOLO_WEIGHTS.parent.mkdir(exist_ok=True)
            _yolo = YOLO(str(YOLO_WEIGHTS))
            _yolo.predict(np.zeros((480, 640, 3), np.uint8), verbose=False)  # прогрів: перший виклик ~3 с
        if _alpr is None:
            try:
                from fast_alpr import ALPR
                _alpr = ALPR()
                _alpr.predict(np.zeros((480, 640, 3), np.uint8))
            except Exception:
                log.exception("fast-alpr недоступний: працюємо без розпізнавання номера")


def decode(data: bytes) -> np.ndarray:
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise BadImage("не вдалося прочитати зображення")
    h, w = img.shape[:2]
    scale = MAX_SIDE / max(h, w)
    return cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else img


def _text_confidence(ocr) -> float:
    """У fast-alpr довіра може бути списком по символах (з паддінгом): беремо мінімум по реальних символах."""
    c = ocr.confidence
    if isinstance(c, (list, tuple, np.ndarray)):
        c = list(c)[: len(ocr.text)]
        return float(min(c)) if c else 0.0
    return float(c)


def detect_car(img: np.ndarray) -> bool | None:
    if _yolo is None:
        return None
    r = _yolo.predict(img, conf=settings.CAR_CONF_MIN, classes=[COCO_CAR, COCO_TRUCK], verbose=False)[0]
    return len(r.boxes) > 0


def read_plate(img: np.ndarray) -> tuple[str | None, float | None]:
    """Єдиний впевнений і валідний кандидат, інакше (None, None)."""
    if _alpr is None:
        return None, None
    found: dict[str, float] = {}
    for r in _alpr.predict(img):
        if not r.ocr or not r.ocr.text:
            continue
        plate = normalize(r.ocr.text, fix_ocr=True)
        conf = _text_confidence(r.ocr)
        if plate and conf >= settings.PLATE_CONF_MIN:
            found[plate] = max(conf, found.get(plate, 0.0))
    if len(found) != 1:  # 0 — нічого впевненого, >1 — неоднозначно: краще unknown
        return None, None
    plate, conf = next(iter(found.items()))
    return plate, round(conf, 3)


def recognize(data: bytes) -> Recognition:
    if not settings.CV_ENABLED:
        return Recognition(enabled=False)
    img = decode(data)
    with _lock:
        car = detect_car(img)
        plate, conf = read_plate(img)
    return Recognition(enabled=True, car_present=car, plate=plate, plate_confidence=conf)
