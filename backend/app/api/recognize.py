from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.services import cv

router = APIRouter(prefix="/api")
MAX_BYTES = 10 * 1024 * 1024


class RecognizeOut(BaseModel):
    enabled: bool                 # false → CV_ENABLED=false, лише ручний ввід
    car_present: bool | None      # None — детектор недоступний
    plate: str | None             # впевнений валідний номер або None → ручний ввід
    plate_confidence: float | None


@router.post("/recognize", response_model=RecognizeOut)
async def recognize_photo(image: UploadFile = File(...)):
    data = await image.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "фото завелике (до 10 МБ)")
    try:
        r = await run_in_threadpool(cv.recognize, data)
    except cv.BadImage as e:
        raise HTTPException(422, str(e))
    return RecognizeOut(enabled=r.enabled, car_present=r.car_present, plate=r.plate, plate_confidence=r.plate_confidence)
