# VILNO: один образ — API (FastAPI) + зібраний фронт. Ваги CV вшиті на етапі build:
# на старті нічого не качаємо (на демо інтернет може лягти).

# --- 1. Фронт ---
FROM node:24-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- 2. API ---
FROM python:3.14-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HOME=/srv/vilno/home

# libgl1 + libglib2.0-0 потрібні opencv-python (його тягне ultralytics)
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --home-dir /srv/vilno/home --uid 10001 vilno

WORKDIR /srv/vilno

# CPU-збірка torch (інакше ultralytics на Linux x86 поставить CUDA на кілька ГБ)
COPY backend/requirements.txt backend/requirements.txt
RUN pip install torch==2.15.0 torchvision==0.29.2 --index-url https://download.pytorch.org/whl/cpu \
 && pip install -r backend/requirements.txt

COPY backend/app backend/app
COPY data/raw data/raw
COPY data/geo_overrides.json data/geo_overrides.json
COPY data/processed data/processed
COPY --from=frontend /build/frontend/dist frontend/dist

# Ваги вшиваємо: YOLO → /srv/vilno/models, fast-alpr → $HOME/.cache. Падаємо, якщо щось не завантажилось.
RUN cd backend && python -c "from app.services import cv; cv.load_models(); assert cv._yolo is not None and cv._alpr is not None, 'CV не завантажився'" \
 && mkdir -p /srv/vilno/var \
 && chown -R vilno:vilno /srv/vilno

# Після вшивання ваг: жодних мережевих запитів ultralytics у рантаймі
ENV YOLO_OFFLINE=1 \
    DATABASE_URL=sqlite:////srv/vilno/var/vilno.db

USER vilno
WORKDIR /srv/vilno/backend
EXPOSE 8000
VOLUME ["/srv/vilno/var"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"

# 1 worker: моделі CV живуть у процесі (RAM), демо-стан у SQLite
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
