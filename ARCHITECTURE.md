# ARCHITECTURE: прототип VILNO (31.10.2026)

> **Застаріло в частинах стеку й CV — див. PLAN.md і CLAUDE.md. §5 (тарифікація, статус скану, тест-кейси) чинний.**

> Деталізація §15 ABOUT.md з рішеннями, погодженими 30.10 (список у PLAN.md, §0).
> Прототип ≠ продакшн. Для продукту мобільний клієнт буде на React Native.

---

## 1. Схема

```
 Телефон водія        Телефон інспектора       Ноутбук диспетчера
 /driver (PWA)        /inspector (PWA)         /city (дашборд)
        \                    |                       /
         \---- HTTPS REST, polling кожні 3–5 с -----/
                             |
              [FastAPI — ЄДИНЕ джерело правди]
               сесії · тарифікація · скани · статуси
               CV-каскад · симулятор · demo-clock
                    |                    |
       [Hosted Postgres]        [Vision-LLM API]
       (один на команду)        (тільки fallback OCR)
                    |
       data/raw/parkinglots_2025-03-27.csv → import
```

- **Фронт ходить тільки в API.** Жодних ключів БД на фронті, жодного прямого Supabase-клієнта.
- **Realtime = polling** 3–5 с (статус сесії, дашборд). Supabase Realtime не використовуємо.
- **Час тільки серверний:** `now() = реальний_час + demo_offset`. Клієнт свого часу не надсилає.

## 2. Стек

| Шар | Технологія | Примітка |
|---|---|---|
| Фронт | React + Vite + TypeScript, PWA | mobile-first; один застосунок, три маршрути |
| Мапа | Leaflet + OpenStreetMap tiles | |
| Камера | `getUserMedia` (live); fallback `<input type="file" accept="image/*" capture="environment">` | fallback позначаємо `capture_method='fallback'` і показуємо «фото могло бути не live» |
| Бекенд | Python 3.11+, FastAPI, SQLAlchemy 2, Pydantic | |
| БД | **один хостований Postgres на команду** (Supabase як хостинг Postgres) | схема — `Base.metadata.create_all()` на старті; **без Alembic, без локального docker-Postgres** |
| CV локально | YOLO (COCO, `car`/`truck`) + `fast-alpr` (детектор пластин + OCR, ONNX, CPU) | альтернатива: YOLO-модель пластин + PaddleOCR/EasyOCR |
| CV fallback | vision-LLM: Claude через офіційний SDK `anthropic` | див. §6 |
| Тести | pytest (бекенд), без e2e | |
| Деплой фронту | Vercel | HTTPS обов'язковий для `getUserMedia` |
| Деплой API | Docker-контейнер з лімітами CPU/RAM на наявному VPS **або** окремий VPS | див. §8 |

## 3. Модель даних

Усі таймстемпи — `timestamptz`. Часова зона бізнес-логіки — `Europe/Kyiv`.

### `zones` (зони — припущення, виведені з ціни; див. DATA.md §3)
| Поле | Тип | |
|---|---|---|
| `id` | text PK | `center` / `standard` / `market` |
| `name` | text | «Центр», «Стандарт», «Ринки/приватні» |
| `price_min`, `price_max` | numeric | діапазон тарифу, з якого виводиться зона |
| `cap_multiplier` | numeric NULL | `3` для `standard`; `NULL` = без ліміту |
| `is_assumption` | bool | `true` |

### `lots` (39 платних + 15 безкоштовних, з набору)
| Поле | Тип | |
|---|---|---|
| `id` | serial PK | |
| `source_ids` | int[] | `identifier` рядків набору, згрупованих в один майданчик |
| `source` | text | `data.gov.ua:parkinglots_2025-03-27` |
| `address` | text | вулиця + номер + літера |
| `description` | text NULL | `addressDescription` перших рядків |
| `operator_name`, `operator_code` | text NULL | |
| `is_paid` | bool | `false` для `вільна` |
| `zone_id` | FK NULL | NULL для безкоштовних |
| `tariff_per_hour` | numeric NULL | |
| `places`, `places_disabled` | int NULL | сума по рядках групи |
| `opening_hours` | jsonb | `{"days":[1,2,3,4,5],"from":"09:00","to":"19:00"}` |
| `lat`, `lon` | float | центроїд рядків групи |
| `points` | jsonb | `[[lat,lon],…]` усіх рядків групи (для мапи) |
| `geo_fixed` | text NULL | `split_field` (#38) / `geocoded` / `manual` (#65–66) |

### `sessions`
| Поле | Тип | |
|---|---|---|
| `id` | uuid PK | |
| `plate_hmac` | char(64) | HMAC-SHA256(нормалізований номер, `PLATE_HMAC_KEY`). **Номер відкритим текстом не зберігаємо** |
| `lot_id` | FK | |
| `started_at`, `ended_at` | timestamptz | `ended_at` NULL = активна |
| `start_lat/lon`, `end_lat/lon` | float NULL | |
| `start_photo_sha256`, `end_photo_sha256` | text NULL | доказ водія: хеш фото + серверний час + геолокація |
| `capture_method` | text | `live` / `fallback` |
| `amount_uah` | numeric NULL | рахується на фініші |
| `status` | text | `active` / `finished` / `paid` |
| `payment_ref` | text NULL | `MOCK-…` |
| `is_simulated` | bool | |

### `scans`
| Поле | Тип | |
|---|---|---|
| `id` | uuid PK | |
| `inspector_id` | FK | |
| `lot_id` | FK | |
| `plate_hmac` | char(64) NULL | NULL, якщо `unknown` без ручного вводу |
| `status` | text | **MVP: `active` / `unpaid` / `closed_but_present` / `unknown`** |
| `ocr_source` | text | `local` / `llm` / `manual` |
| `ocr_confidence` | float NULL | |
| `confirmed_by_inspector` | bool | |
| `session_id` | FK NULL | |
| `minutes_since_close` | int NULL | для `closed_but_present` |
| `lat`, `lon`, `scanned_at` | | |
| `is_simulated` | bool | |

### `inspectors` (`id`, `name`) · `demo_state` (один рядок: `clock_offset_seconds`, `alert_active`)
### Should: `routes` (`id`, `inspector_id`, `date`, `lot_ids int[]`, `expected_gain`), `exemptions` (`plate_hmac`, `type`)

**Фото.** Файли фото не зберігаємо в БД. CV обробляє їх у пам'яті, зберігається тільки SHA-256. Якщо потрібен показ доказу в демо — тимчасова папка в контейнері, яку чистить `POST /demo/reset`.

## 4. API

Базовий префікс `/api`. Відповіді — JSON. Помилки — `{"detail": "..."}`.

| Метод | Шлях | Що робить | Must/Should |
|---|---|---|---|
| GET | `/lots` | усі майданчики + `zone`, `tariff_per_hour`, `is_paid`, `free_estimate`, `paid_now` | Must |
| GET | `/lots/{id}` | деталі майданчика | Must |
| GET | `/zones` | зони з `is_assumption` | Must |
| POST | `/recognize` | multipart `image`, `purpose=driver|inspector` → `{plate, confidence, source, car_detected, bbox}` або `{plate:null, source:"none"}` | Must |
| POST | `/sessions` | `{plate, lot_id, lat, lon, photo_sha256, capture_method}` → сесія. 409, якщо лот безкоштовний | Must |
| GET | `/sessions/{id}` | статус + `amount_so_far` (polling) | Must |
| POST | `/sessions/{id}/finish` | `{lat, lon, photo_sha256}` → `amount_uah`, розбивка по днях | Must |
| POST | `/sessions/{id}/pay` | mock-оплата → `payment_ref` | Must |
| GET | `/tariff/quote?lot_id&from&to` | розрахунок без сесії (для демо-таблиці) | Must |
| POST | `/scans` | `{plate \| null, lot_id, ocr_source, ocr_confidence, lat, lon}` → `{status, paid_now, minutes_since_close?, session_on_other_lot?, grace_after_close?, recheck_after_min?}` (§5.2) | Must |
| GET | `/stats/heatmap?weekday` | лот × година → `unpaid_share_per_scan`, `n_scans`, `is_simulated` | Must |
| GET | `/stats/dispatch?at` | по лотах: очікувана вигода виїзду (§7) і рішення «їхати / тільки в маршруті» | Must |
| POST | `/demo/clock` | `{set:"2026-10-30T14:00:00+02:00"}` або `{advance_minutes:90}` | Must |
| POST | `/demo/simulate` | перегенерувати симуляцію з `SIM_SEED` | Must |
| POST | `/demo/reset` | видалити не-симульовані демо-сесії і скани, скинути годинник | Must |
| GET | `/routes/today` | рекомендований маршрут | Should |
| POST | `/demo/alert` | перемикач тривоги (пауза таймера) | Should |
| GET | `/export/dataset.csv`, `.json` | агрегати з DATA.md §6 | Should |

**Захист `/demo/*`.** Усі ендпоінти `/demo/*` вимагають заголовок `X-Demo-Token`, що дорівнює `DEMO_TOKEN` з `.env`. Порівняння — `secrets.compare_digest`. Немає заголовка або він не збігається → **403**. Якщо `DEMO_TOKEN` порожній → `/demo/*` завжди 403. Токен **не** кладемо у `VITE_*` (він потрапив би в публічний бандл). Демо-панель на фронті просить ввести токен вручну і тримає його в `sessionStorage`.

**Номер у запитах.** Фронт надсилає нормалізований номер. Бекенд одразу рахує HMAC і далі працює тільки з ним. У логах номер не друкуємо.

## 5. Бізнес-логіка

### 5.1 Тарифікація
```
для кожного календарного дня d, що перетинає [started_at, ended_at]:
    хв_d   = хвилини перетину з openingHours лоту в день d   # поза годинами — 0
    сума_d = tariff × ceil(хв_d) / 60                          # до копійки
    якщо zone.cap_multiplier: сума_d = min(сума_d, cap_multiplier × tariff)
сума = Σ сума_d
```
Ліміт **денний** і обнуляється з кінцем `openingHours` (для 24/7-лоту — з кінцем календарного дня).
Тест-кейси (`backend/tests/test_tariff.py`). Дати: Пн 26.10.2026, Сб 31.10.2026.

| Лот | Інтервал | Очікувано |
|---|---|---|
| center, 20 грн, Пн–Пт 09–19 | Пн 10:00–10:09 | 3,00 |
| center | Пн 10:00–11:30 | 30,00 |
| center | Пн 10:00–14:00 | 80,00 (ліміту немає) |
| center | Пн 18:00–20:00 | 20,00 (19–20 безкоштовно) |
| center | Сб 10:00–12:00 | 0,00 (вихідний) |
| standard, 10 грн, Пн–Пт 09–19 | Пн 10:00–11:30 | 15,00 |
| standard, 10 грн | Пн 10:00–13:00 | 30,00 (ліміт) |
| standard, 10 грн | Пн 10:00–17:00 | 30,00 |
| standard, 15 грн | Пн 10:00–11:30 | 22,50 |
| standard, 10 грн, 24/7 | Пн 20:00 → Вт 10:00 | 60,00 (30 + 30) |
| market, 5 грн, щодня 09–18 | Пн 10:00–16:00 | 30,00 (у зони `market` ліміту немає) |

### 5.2 Статус скану
Правила перевіряються згори вниз, спрацьовує перше:
```
1. plate == null (інспектор не підтвердив/не ввів)        → unknown
2. лот зараз поза openingHours                            → paid_now=false, у статистику не йде
3. активна сесія (ended_at IS NULL) на ЦЬОМУ лоті         → active
4. сесія на цьому лоті закрита t хв тому:
     t ≤ GRACE_END_MIN                                    → active, grace_after_close=true, minutes_since_close=t
     GRACE_END_MIN < t ≤ CLOSED_PRESENT_WINDOW_MIN        → closed_but_present, minutes_since_close=t
5. активна сесія на ІНШОМУ лоті                           → unpaid, session_on_other_lot=true
6. інакше                                                 → unpaid
```
- Для `grace_after_close=true` UI інспектора показує **«Сесію закрито N хв тому, водій від'їжджає»** нейтральним кольором (не зеленим, як `active`, і не червоним).
- Для кожного `unpaid` у відповіді є `recheck_after_min = GRACE_END_MIN`. UI інспектора показує підказку: **«Можливо, щойно приїхав: повторіть скан через {recheck_after_min} хв»**.
- Нових статусів немає. `grace_after_close` і `session_on_other_lot` — це поля відповіді, не статуси.
- Штраф рекомендує система, вирішує інспектор. В UI немає кнопки «оформити штраф», тільки статус.
- `exempt` (Should) — перевіряється перед п.3 за таблицею `exemptions`.

Тест-кейси (`backend/tests/test_scan_status.py`). Константи: `GRACE_END_MIN=10`, `CLOSED_PRESENT_WINDOW_MIN=240`, лот L1 у робочі години.

| Стан на момент скану на L1 | Очікувано |
|---|---|
| `plate = null` | `unknown` |
| лот поза `openingHours` (Сб для МіськШЕП) | `paid_now=false` |
| активна сесія на L1 | `active` |
| активна сесія на L2 | `unpaid`, `session_on_other_lot=true` |
| сесія на L1 закрита 5 хв тому | `active`, `grace_after_close=true` |
| сесія на L1 закрита рівно 10 хв тому | `active`, `grace_after_close=true` (межа включно) |
| сесія на L1 закрита 11 хв тому | `closed_but_present`, `minutes_since_close=11` |
| сесія на L1 закрита 240 хв тому | `closed_but_present`, `minutes_since_close=240` |
| сесія на L1 закрита 241 хв тому | `unpaid` |
| сесія на L2 закрита 30 хв тому | `unpaid` (не `closed_but_present`: закрита на іншому лоті) |
| сесій немає | `unpaid`, `recheck_after_min=10` |

### 5.3 Оцінка вільних місць
`free_estimate = places − активні_сесії(реальні + симульовані)`. На мапі завжди підпис «оцінка · симуляція».

## 6. CV-пайплайн (українські номери)

**Ручний ввід є з першої години і завжди доступний.** CV лише заповнює поле, яке людина підтверджує.

```
фото (JPEG, ≤1600 px по довшій стороні)
 │
 ├─ 1. Є авто? YOLO COCO car/truck (conf ≥ 0.4)
 │      водій: немає авто → «на фото немає авто», сесію не стартуємо
 │
 ├─ 2. Локальний ALPR (fast-alpr): bbox пластини + текст + confidence
 │
 ├─ 3. Нормалізація → регулярка
 │      кирилиця → латиниця: А→A В→B Е→E І→I К→K М→M Н→H О→O Р→P С→C Т→T Х→X
 │      позиційні заміни: у позиціях літер 0→O 1→I 8→B; у позиціях цифр O→0 I→1 B→8
 │      ^[ABCEHIKMOPTX]{2}[0-9]{4}[ABCEHIKMOPTX]{2}$
 │      ok і confidence ≥ θ_local → результат, source=local
 │      θ_local = OCR_LOCAL_THRESHOLD: найнижчий поріг, за якого на тестовому наборі 0 хибних прочитань
 │
 ├─ 4. Fallback: vision-LLM (тільки кроп пластини, не все фото)
 │      structured output: {plate: string|null, readable: bool, confidence: "low"|"medium"|"high"}
 │      → та сама нормалізація + регулярка
 │      ok і confidence ≠ low → результат, source=llm
 │      таймаут 8 с, помилка, відмова (stop_reason="refusal") → крок 5
 │
 └─ 5. unknown → порожнє поле, ручний ввід
```

- **Vision-LLM:** офіційний Python SDK `anthropic`, модель зі змінної `VISION_LLM_MODEL`, `effort: low`.
  - **Модель не зафіксована.** У задачі B1 порівнюємо `claude-opus-5-5` і `claude-haiku-5-5` на тих самих 20 фото. Результат — `backend/tests/fixtures/plates/RESULTS.md`, колонки **правильно / хибно / unknown / p50 / p95**.
    - *Хибне прочитання* — модель повернула впевнений номер (пройшов регулярку, `confidence ≠ low`), і він не збігається з еталоном.
    - *Unknown* — `plate = null`, `confidence = low`, номер не пройшов регулярку, відмова або таймаут.
  - **Критерії вибору, по черзі:**
    1. найменше хибних — головний критерій;
    2. найбільше правильних;
    3. p95 ≤ 8 с — обов'язкова умова, інакше модель вибуває;
    4. якщо за п.1 і п.2 різниця ≤ 1 фото з 20 — швидша за p95.

    Переможця ставимо у `VISION_LLM_MODEL` в `.env.example`. Обидві вибули → `VISION_LLM_ENABLED=false`.
  - Відповідь беремо через structured outputs (`client.messages.parse` з Pydantic-схемою). Зображення передаємо base64-блоком `image`.
  - Server-side fallbacks **не використовуємо**. Відмова (`stop_reason="refusal"`), таймаут чи помилка → `unknown`.
  - `VISION_LLM_ENABLED=false` вимикає крок 4 (немає мережі / ключа). Каскад тоді йде одразу в `unknown`.
  - **Приватність:** назовні йде тільки кроп пластини. У пітчі це прямо кажемо.
- **Формати поза регуляркою** (транзитні, дипломатичні, іноземні, старі радянські) → `unknown` → ручний ввід. Це свідомо.
- **Бюджет часу:** локально ≤ 1–2 с на CPU; з LLM ≤ 8 с. Моделі вантажимо один раз на старті процесу.
- **Тестовий набір:** 20 фото українських номерів (різна відстань, кут, освітлення) у `backend/tests/fixtures/plates/`. **Тільки свої машини і машини знайомих, без облич людей.** Метрика: % правильних номерів на кожному кроці + частка `unknown`.

## 7. Симулятор (для дашборду; усе `is_simulated=true`)

- **Період:** 4 тижні до demo-clock (Пт 30.10.2026 14:00 Europe/Kyiv), тільки в `openingHours` кожного лоту. Seed `SIM_SEED`, результат відтворюваний.
- **Зайнятість:** профіль за годинами (пік 11–14), середнє ≈ 60% (припущення §8.1). Прибуття — Пуассон. Тривалість — логнормальна (медіана: центр 50 хв, стандарт 90 хв, ринки 60 хв).
- **Неоплата на лот:** Beta-розподіл із середнім 35% (center), 20% (standard), 15% (market) — числа з прикладу §6.2. Плюс 5% платників «закрили сесію, але стоять».
- **Скани:** 2 інспектори × 8 візитів/день × ~5 авто. 15% візитів — випадкові лоти (§6.3 п.3). Решта рівномірні (холодний старт).
- **Згладжування:** `p_lot = (unpaid + k·p_zone) / (n_scans + k)`, `k = 10`. Без цього теплова мапа шумить на малих вибірках.
- **Вигода виїзду (§6.1):** `cars_present × p_lot × (20 × tariff) × 0.63`. Порівнюємо з `TRIP_COST_UAH = 200`. Константи — в конфігу з позначкою «припущення».
- **UI:** кожен графік і число, що походить із симуляції, має бейдж **«Симуляція»**.

## 8. Деплой

- **Фронт:** Vercel. `VITE_API_URL` — HTTPS-адреса API.
- **API: варіант 1 — наявний VPS, ізольовано.**
  - окремий compose-проєкт `vilno` (`deploy/docker-compose.vps.yml`), власна docker-мережа;
  - ліміти: `cpus: 2`, `mem_limit: 3g` (уточнити за вільними ресурсами VPS);
  - порт тільки на `127.0.0.1`;
  - HTTPS через окремий контейнер `cloudflared` (tunnel), щоб **не чіпати nginx і продакшн-сервіси хоста**.
- **API: варіант 2** — окремий VPS, якщо на основному немає вільних ресурсів.
- Заборонено на спільному VPS: `docker system prune`, `docker compose down` поза проєктом `vilno`, зупинка чужих контейнерів, правки `/etc/nginx`, `ufw`, systemd.
- CORS: тільки домен Vercel і `localhost`.

## 9. Структура репозиторію

```
VILNO/
  ABOUT.md DATA.md ARCHITECTURE.md PLAN.md CLAUDE.md
  .env.example  .gitignore
  data/raw/parkinglots_2025-03-27.csv      # оригінал, не редагувати
  data/processed/lots.json                  # генерує scripts/import_lots.py
  backend/
    app/main.py config.py db.py
    app/models/          # SQLAlchemy-моделі
    app/api/             # роутери: lots, sessions, scans, recognize, stats, demo
    app/services/        # tariff.py, scan_status.py, plate.py, clock.py, dispatch.py
    app/cv/              # detect.py, alpr.py, llm_fallback.py, pipeline.py
    app/sim/             # simulate.py
    tests/               # test_tariff.py, test_plate.py, test_scan_status.py, fixtures/
    Dockerfile  requirements.txt
  frontend/
    src/pages/driver/  src/pages/inspector/  src/pages/city/
    src/components/  src/api/  src/lib/
  scripts/import_lots.py  reset_db.py
  deploy/docker-compose.vps.yml
  presentation-style/    # наявне
```

## 10. Змінні оточення (`.env.example`)

```
DATABASE_URL=postgresql+psycopg://...
PLATE_HMAC_KEY=
ANTHROPIC_API_KEY=
VISION_LLM_ENABLED=true
VISION_LLM_MODEL=                 # claude-opus-5-5 або claude-haiku-5-5 — за результатом B1
OCR_LOCAL_THRESHOLD=0.85          # стартове значення; після B1 — найнижчий поріг з 0 хибних
GRACE_END_MIN=10                  # припущення: пільговий час після закриття сесії
CLOSED_PRESENT_WINDOW_MIN=240
DEMO_TOKEN=                       # заголовок X-Demo-Token для /demo/*
DEMO_CLOCK_START=2026-10-30T14:00:00+02:00
SIM_SEED=31102026
TRIP_COST_UAH=200
FINE_PAYMENT_PROB=0.63
CORS_ORIGINS=http://localhost:5173
VITE_API_URL=http://localhost:8000
```
