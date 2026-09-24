# Part 5 — Data Analytics

Read-only analytics over the incident database owned by `hospital-website/backend`. Turns raw
incidents into road-safety insight: red-zone hotspots, hourly patterns, and severity distributions.

## Ownership

Team member 5.

## Contents

- [`service/`](service) — dependency-free aggregation (stdlib `sqlite3`) exposed as a FastAPI
  service on port 8001 (`/analytics/summary`, `/analytics/incidents`).
- [`web/`](web) — React + Recharts analytics site on port 5174.

## Run

```bash
# service (port 8001) — needs the backend to have written incidents.db
cd service && pip install -r requirements.txt && uvicorn main:app --port 8001

# site (port 5174)
cd web && npm install && npm run dev
```

The service reads `hospital-website/backend/incidents.db` (override with the `DB_PATH` env var).
The site targets `http://localhost:8001` (override with `VITE_ANALYTICS_API`).

## Roadmap

- DBSCAN clustering instead of fixed grid cells.
- Response-time statistics (dispatch → arrival) once timestamps are recorded.
- Time-of-day / weather risk modeling and forecasting.
