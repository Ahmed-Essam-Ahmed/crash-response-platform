# Part 5 — National Analytics (Authority View)

A read-only analytics service for national oversight, integrated into the hospital website's authority dashboard. It aggregates incidents across all hospitals to produce red zones, demographics, response times, and temporal patterns.

## Contents

- [`service/`](service) — FastAPI analytics service (port 8001). Reads the hospital database read-only (`hospital-website/data/hospital.db`).
- The **dashboard UI** lives in [`hospital-website/web/src/components/authority/`](hospital-website/web/src/components/authority/) and is shown to users with role `authority`.

## Run

```bash
# analytics service (port 8001)
cd service
pip install -r requirements.txt
uvicorn main:app --port 8001
```

The dashboard is embedded in the hospital website and authenticates with the same login/token as the hospital backend.

## Features

- Region filtering (derived from lat/lon)
- Hotspots (red zones) by fixed grid
- Hourly/weekday/trend breakdowns
- Severity distribution
- Demographics (age group, sex)
- By region, by hospital, by destination/status
- Response time statistics (accept, scene travel, hospital travel, total)
- Authority-only access (role `authority`)

The service validates bearer tokens against the hospital database (`auth_tokens` + `users`).
