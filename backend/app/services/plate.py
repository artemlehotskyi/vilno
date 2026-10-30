"""Нормалізація українського номера (AA 1234 BB) і псевдонімізація (HMAC-SHA256).
Номер відкритим текстом не зберігаємо і не логуємо: в БД лише plate_hmac."""
import hashlib
import hmac
import re

from app.config import settings

# Літери кирилицею, що виглядають як латинські (формат номера дозволяє лише ці 12)
CYR_TO_LAT = str.maketrans({
    "А": "A", "В": "B", "Е": "E", "І": "I", "К": "K", "М": "M",
    "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X",
})
PLATE_RE = re.compile(r"^[ABCEHIKMOPTX]{2}\d{4}[ABCEHIKMOPTX]{2}$")

# Типові помилки OCR за позицією: у позиціях літер цифри, у позиціях цифр літери
LETTER_FIX = {"0": "O", "1": "I", "8": "B"}
DIGIT_FIX = {"O": "0", "I": "1", "B": "8"}
LETTER_POS = (0, 1, 6, 7)
DIGIT_POS = (2, 3, 4, 5)


def normalize(raw: str | None, fix_ocr: bool = False) -> str | None:
    """Повертає номер у вигляді 'AA1234BB' (латиниця) або None, якщо формат не збігається.
    fix_ocr=True (лише для результату CV) виправляє 0/O, 1/I, 8/B за позицією.
    Для ручного вводу виправлень немає: людина бачить помилку й виправляє сама."""
    if not raw:
        return None
    s = re.sub(r"[\s\-–—_.]", "", raw).upper().translate(CYR_TO_LAT)
    if fix_ocr and len(s) == 8:
        chars = list(s)
        for i in LETTER_POS:
            chars[i] = LETTER_FIX.get(chars[i], chars[i])
        for i in DIGIT_POS:
            chars[i] = DIGIT_FIX.get(chars[i], chars[i])
        s = "".join(chars)
    return s if PLATE_RE.match(s) else None


def plate_hmac(plate: str) -> str:
    key = settings.PLATE_HMAC_KEY
    if not key:
        raise RuntimeError("PLATE_HMAC_KEY не задано в .env")
    return hmac.new(key.encode(), plate.encode(), hashlib.sha256).hexdigest()
