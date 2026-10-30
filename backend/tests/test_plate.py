import pytest

from app.config import settings
from app.services.plate import normalize, plate_hmac


@pytest.mark.parametrize("raw", ["AA1234BB", "aa 1234 bb", "AA-1234-BB", " AA 1234 BB ", "АА 1234 ВВ", "аа1234вв"])
def test_normalize_accepts_formats(raw):
    assert normalize(raw) == "AA1234BB"


def test_cyrillic_letters_mapped_to_latin():
    # А В Е І К М Н О Р С Т Х → A B E I K M H O P C T X
    assert normalize("АВ 1234 ЕІ") == "AB1234EI"
    assert normalize("КМ 0000 НО") == "KM0000HO"
    assert normalize("РС 9999 ТХ") == "PC9999TX"


@pytest.mark.parametrize("raw", [None, "", "AA123BB", "AA12345BB", "DD1234BB", "AA1234BBB", "1234AABB", "AA 12A4 BB", "ЙЦ1234УК"])
def test_normalize_rejects_invalid(raw):
    assert normalize(raw) is None


def test_manual_input_is_not_silently_fixed():
    assert normalize("AA12O4BB") is None      # O замість 0 у ручному вводі: це помилка людини
    assert normalize("0A1234BB") is None


def test_ocr_fix_by_position():
    assert normalize("AA12O4BB", fix_ocr=True) == "AA1204BB"
    assert normalize("0A1234B8", fix_ocr=True) == "OA1234BB"
    assert normalize("AAI234BB", fix_ocr=True) == "AA1234BB"


def test_ocr_fix_does_not_invent_valid_plate_from_garbage():
    assert normalize("ZZ1234BB", fix_ocr=True) is None
    assert normalize("AA123BB", fix_ocr=True) is None


def test_hmac_deterministic_and_not_plaintext(monkeypatch):
    monkeypatch.setattr(settings, "PLATE_HMAC_KEY", "k1")
    h = plate_hmac("AA1234BB")
    assert h == plate_hmac("AA1234BB")
    assert len(h) == 64 and "AA1234BB" not in h
    assert h != plate_hmac("AA1234BC")


def test_hmac_depends_on_key(monkeypatch):
    monkeypatch.setattr(settings, "PLATE_HMAC_KEY", "k1")
    a = plate_hmac("AA1234BB")
    monkeypatch.setattr(settings, "PLATE_HMAC_KEY", "k2")
    assert plate_hmac("AA1234BB") != a


def test_hmac_requires_key(monkeypatch):
    monkeypatch.setattr(settings, "PLATE_HMAC_KEY", "")
    with pytest.raises(RuntimeError):
        plate_hmac("AA1234BB")
