# CLAUDE.md: правила для агента в репозиторії VILNO

Хакатон-прототип, **один розробник, 4 години** (скоуп урізано 30.10). Контекст: `ABOUT.md` (ідея), `DATA.md` (дані), `PLAN.md` (скоуп, фічі, спрощення), `ARCHITECTURE.md` (формули й таблиці тест-кейсів).
**Де ARCHITECTURE.md суперечить PLAN.md чи цьому файлу — діють PLAN.md і CLAUDE.md.** Якщо щось неясно — обери найпростіший варіант і запиши одним рядком у `PLAN.md` §2 або §5. Не питай, не відкривай нових питань.

## Стек
- **Фронт:** React + Vite + TypeScript, mobile-first SPA, Leaflet + OSM. Маршрути `/driver`, `/inspector`, `/city`. Без PWA-маніфесту.
- **Бекенд:** Python 3.11+, FastAPI, SQLAlchemy 2, Pydantic, pytest.
- **БД:** SQLite (`sqlite:///./vilno.db`), `Base.metadata.create_all()`. **Не додавати** Postgres, Alembic, Docker, Supabase.
- **CV (F8, повністю локальний):** pretrained YOLO (COCO, `car`/`truck`, conf ≥ 0.4) для «є авто» + `fast-alpr` для номера → нормалізація → регулярка. Моделі вантажити один раз на старті процесу. **Жодних зовнішніх API** (ні LLM, ні хмарних OCR). Таймбокс на `fast-alpr` 20 хв; не запрацював → тільки «є авто», номер вручну.
- **Деплой:** немає. Локально; телефон через тунель на Vite (`:5173`) у кінці, якщо буде час.
- Фронт ходить тільки у FastAPI (Vite proxy `/api → :8000`).

## Структура
```
backend/app/{api,models,services,sim}/   backend/tests/
frontend/src/{pages,components,api,lib}/
data/raw/          # оригінали з data.gov.ua, НЕ редагувати
data/geo_overrides.json   # координати для рядків набору без них (#65–66), з походженням
scripts/           # import_lots.py, reset_db.py
```
Імпорт пише прямо в SQLite. `data/processed/` не створювати. Нові верхньорівневі папки без потреби не додавати.

## Коміти
- **Одна фіча = один коміт.** Фіча = один ID із `PLAN.md` §3 (F0…F8). Не змішувати фічі, не дробити одну.
- Формат: `feat(F4): sessions API + mock pay`, `fix(F5): …`, `test(F3): …`.
- Перед комітом: `pytest` у `backend/` зелений; `npm run build` у `frontend/` проходить.
- `git add` — тільки конкретні файли, не `git add -A` / `git add .`.
- Після feature-freeze (T+2:30) — тільки багфікси.

## Секрети
- Ключі тільки в `.env`. `.env` і `*.db` у `.gitignore`. В `.env.example` — назви без значень (крім безпечних дефолтів).
- Не вписувати ключі в код, тести, логи, коміти, фронт. На фронт іде максимум `VITE_*` без секретів.
- Секрет потрапив у коміт → зупинитись і сказати людині (ключ відкликати, а не просто видалити з історії).
- `.env.example`: `DATABASE_URL`, `PLATE_HMAC_KEY`, `CV_ENABLED=true`, `CAR_CONF_MIN=0.4`, `PLATE_CONF_MIN=0.85`, `GRACE_END_MIN=10`, `CLOSED_PRESENT_WINDOW_MIN=240`, `DEMO_TOKEN`, `DEMO_CLOCK_START=2026-10-30T14:00:00+02:00`, `SIM_SEED`, `TRIP_COST_UAH=200`, `FINE_PAYMENT_PROB=0.63`.

## Дані та чесність демо
- **Демо на справжніх даних міста:** лоти, адреси, координати, тарифи, оператори, години — з `data/raw/parkinglots_2025-03-27.csv` через `scripts/import_lots.py`. Жодного lorem ipsum і вигаданих майданчиків.
- **Симуляцію підписувати.** Кожен блок, число чи графік із симулятора має бейдж «Симуляція». Оцінка вільних місць — «оцінка · симуляція». Симулятор нічого не пише в БД.
- **Припущення підписувати:** зони (з ціни), 200 грн виїзду, 0,63, 60% зайнятості, `GRACE_END_MIN`. Константи — в конфігу, не в коді.
- Не вигадувати цифри в UI, коментарях і документах.

## Правила домену
- **Час тільки серверний:** `services/clock.py::now()` = реальний час + offset з `demo_state`. Клієнтський час не приймати.
- **Номери:** нормалізувати → HMAC-SHA256 з `PLATE_HMAC_KEY` одразу на вході; відкритим текстом не зберігати й не логувати.
- **Хибний номер гірший за `unknown`.** Невпевнено, не пройшло регулярку, помилка чи `CV_ENABLED=false` → `plate=null` → ручний ввід. `PLATE_CONF_MIN` не знижувати, щоб «розпізнавало більше».
- **Ручний ввід номера працює завжди**, незалежно від CV. Номер підтверджує людина.
- **Штраф оформлює людина.** В UI немає кнопки «оформити штраф».
- **Статуси:** `active` / `unpaid` / `closed_but_present` / `unknown`. Нових не додавати; уточнення — поля відповіді (`session_on_other_lot`, `grace_after_close`, `minutes_since_close`, `recheck_after_min`). Правила й таблиця тест-кейсів — ARCHITECTURE §5.2.
  - `active` — тільки сесія на **цьому** лоті; на іншому → `unpaid` + `session_on_other_lot=true`.
  - Закрито ≤ `GRACE_END_MIN` тому → `active` + `grace_after_close=true` (нейтральний колір). `GRACE_END_MIN` < t ≤ `CLOSED_PRESENT_WINDOW_MIN` → `closed_but_present`.
- **Тарифікація:** поза `openingHours` безкоштовно; зона `standard` — денний ліміт 3 × тариф; `center` і `market` без ліміту. Тест-кейси — ARCHITECTURE §5.1. Змінив логіку тарифу чи статусу — онови тести.
- Безкоштовні лоти (`is_paid=false`): сесію не стартувати (409), на мапі сірим.
- `/demo/*` — заголовок `X-Demo-Token` = `DEMO_TOKEN`, без нього 403 (порожній `DEMO_TOKEN` → завжди 403). Токен не класти у `VITE_*`; демо-панель просить ввести його вручну.
- Фото обробляти в пам'яті, на диск і в БД не зберігати. Тестові фото — тільки свої машини і машини знайомих, без облич людей.

## Скоуп
- Тільки F0–F8 з `PLAN.md`. **Should не робимо:** маршрут, тривога, експорт, `exempt`.
- **Won't:** реальна оплата (лише mock), камери, реальні штрафи й реєстри, «борг», авторизація, геолокація, хеші фото, VPS, Postgres.

## «Готово» означає
1. Працює в браузері (на телефоні, якщо є тунель) і виконано критерій «готово» фічі з `PLAN.md`.
2. Тести на змінену логіку зелені.
3. Один коміт із ID фічі.

## Команди
```
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
pytest

cd frontend && npm install && npm run dev -- --host
npm run build

python scripts/import_lots.py     # CSV → SQLite (ідемпотентно)
python scripts/reset_db.py        # drop + create_all + імпорт; запускати тільки після підтвердження людини
```
(Уточнити після F0.)

## Мова
UI, коміти, коментарі до бізнес-логіки — українською. Ідентифікатори в коді — англійською.
