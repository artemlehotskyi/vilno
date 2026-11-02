<p align="center">
  <img src=".github/assets/banner.svg" alt="VILNO — Free. Visible. Paid." width="100%">
</p>

<p align="center">
  <b>The payment app knows you paid. It doesn't know whether your car is still there.</b><br>
  VILNO verifies presence: drivers pay for the real minutes, inspectors see a payment status in a second, the city sees where to go.
</p>

<p align="center">
  <b>English</b> · <a href="README.uk.md">Українська</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/🏆_3rd_place-Chernivtsi_Open_Data_Hackathon_3.0-1F1F1D?style=flat-square" alt="3rd place, Chernivtsi Open Data Hackathon 3.0">
  <img src="https://img.shields.io/badge/data-data.gov.ua-1F1F1D?style=flat-square" alt="Open data from data.gov.ua">
  <img src="https://img.shields.io/badge/CV-fully_local-1F1F1D?style=flat-square" alt="Fully local computer vision">
</p>

---

## The problem

Paid parking exists in cities, but payment enforcement barely does. By a Kyiv benchmark, one in three drivers doesn't pay, because the chance of a fine is low. Inspectors walk their rounds out of habit, not where non-payment actually happens. Cities digitised **payment**; nobody digitised **verification**.

VILNO doesn't compete with Privat24 or Kyiv Digital. It works on top of them: it checks presence and gives the city the data to target enforcement.

> The UI is in Ukrainian, since it is built on the open data of Chernivtsi, Ukraine.

## How it works

Three sides of one system, three screens in a phone browser.

| | Who | What they do |
|---|---|---|
| **`/driver`** | Driver | Sees a map of parking lots, photographs the car at start and finish, pays for real minutes, capped at the zone's daily limit |
| **`/inspector`** | Inspector | Points the camera at a plate and sees the payment status in a second. Only a human issues a fine |
| **`/city`** | City | Dashboard: where non-payment is, where a trip is worth it, where to route inspectors |

### Scan statuses

| Status | Meaning |
|---|---|
| `active` | A session is active on this lot (or closed ≤ 10 min ago: the driver is leaving) |
| `unpaid` | No payment. A separate flag marks "paid on another lot" |
| `closed_but_present` | Session closed more than 10 min ago, car still here: catches "photographed the finish and stayed" |
| `unknown` | The model isn't sure, or the lot is outside opening hours: manual entry |

### Pricing: per minute, with a cap

The driver chooses nothing. They pay per minute, and the system guarantees they never pay more than a "package" price, like fare capping in public transport.

| Zone (assumption, derived from price) | Rate | Cap |
|---|---|---|
| `center` | 20 UAH/h | none |
| `standard` | 10–15 UAH/h | 3 × rate per day |
| `market` | 3–5 UAH/h | none |

Outside `openingHours` parking is free. Example: 10 UAH/h and 4 hours of parking cost 30 UAH, not 40.

### Where inspectors should go

```
benefit = cars × non_payment_rate × (20 × rate) × 0.63      →  go if benefit > 200 UAH
```

The fine for non-payment is 20 × the hourly rate (Art. 152-1 of the Code of Administrative Offences). The 0.63 and 200 UAH figures are assumptions, and the UI labels them as such.

## Principles

- **The system recommends, a human decides.** There is no "issue a fine" button in the UI.
- **A wrong plate is worse than `unknown`.** If the model isn't sure, it stays silent and the plate is entered by hand.
- **Privacy.** Computer vision runs entirely locally, with no external APIs. Photos are processed in memory and never stored. Plates are kept only as HMAC-SHA256.
- **The "no free spots" report is not a tool for checking other people's plates.** The client always gets the same `{"ok": true}`.
- **An honest demo.** Lots, addresses, coordinates and tariffs come from the real dataset. Everything simulated carries a "Simulation" badge.

## Data

Foundation: the Chernivtsi City Council dataset on [data.gov.ua](https://data.gov.ua), "Register of parking lots of the Chernivtsi territorial community" (as of 27 Mar 2025).

- **55 paid rows → 39 lots**, 848 spaces, plus free lots (grey on the map).
- 26 lots run by MiskSHEP and 7 private operators.
- The original is in `data/raw/`; the dataset's defects and our fixes are listed in [`DATA.md`](DATA.md).

Map attribution in the app: OpenStreetMap contributors and data.gov.ua.

## Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, TypeScript, Leaflet + OSM, Montserrat, Phosphor Icons |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2, Pydantic, pytest |
| Database | SQLite |
| CV | YOLO (COCO, `car` / `truck`) for "is there a car" and `fast-alpr` for the plate |
| Deploy | Docker (multi-stage), cloudflared quick tunnel |

## Getting started

Requires Python 3.11+ and Node.js.

```bash
cp .env.example .env            # fill in PLATE_HMAC_KEY and DEMO_TOKEN
```

**Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000   # an empty DB is filled by the lot import from data/raw
pytest
```

**Frontend**

```bash
cd frontend
npm install
npm run dev -- --host                  # Vite proxies /api → :8000
npm run build
```

Then open `/driver`, `/inspector` or `/city`. CV weights are downloaded on first run; after that everything works offline.

**Demo panel.** The `/demo/*` endpoints (server clock fast-forward, reset) require an `X-Demo-Token` header equal to `DEMO_TOKEN`. Server time is the only source of time; client time is never accepted.

**Docker**

```bash
docker build -t vilno-api:latest .
cd deploy && docker compose up -d --build   # needs deploy/.env.prod
```

In the image, FastAPI serves the built frontend itself, so no CORS or `VITE_API_URL` is needed. CV weights are baked into the image, and SQLite lives in the `vilno-data` volume.

## Structure

```
backend/app/{api,models,services,sim}/   FastAPI, tariffs, scan statuses, CV, simulator
backend/tests/                           tariffs, statuses, plates, sessions, reports…
frontend/src/{pages,components,api,lib}/ the /driver /inspector /city screens
data/raw/                                original dataset from data.gov.ua
scripts/                                 import_lots.py, reset_db.py
deploy/                                  docker-compose for the VPS
```

## Documentation

The project documents are written in Ukrainian.

| File | About |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Pricing and status formulas, test cases |
| [`DATA.md`](DATA.md) | Dataset analysis |
| [`DESIGN.md`](DESIGN.md) | Tokens, colour rules, motion |

## Status

A hackathon prototype built in a single day. A real product would use a React Native mobile client. Payment is a mock, and sessions and scans are for demonstration. Car counts, occupancy and the non-payment rate on the dashboard are a simulation with a fixed seed. The real non-payment rate can only be measured by a pilot with inspector scans.

---

<p align="center">
  <sub>Team <b>VILNO</b> · Chernivtsi Open Data Hackathon 3.0 · 30–31 Oct 2026</sub>
</p>
