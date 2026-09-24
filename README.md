# Mobile Crash Detection & Intelligent Emergency Response Platform

A fully simulated, phone-based accident detection system with AI severity rating, real-time
emergency coordination, hospital workflows, and road-safety analytics. Inspired by Apple's Crash
Detection and extended with structured hospital coordination, emergency-contact notification,
medical-profile transmission, and hotspot analytics. No hardware is used — a simulation engine
replaces physical sensors.

## Team & Module Ownership (5 parts)

| # | Part | Description | Tech |
|---|------|-------------|------|
| 1 | [`mobile-app/`](mobile-app) | Phone client: consumes simulated sensor streams, detects locally, and builds the emergency payload (location, medical profile, severity) | React Native |
| 2 | [`hospital-website/`](hospital-website) | **Full-stack** responder console + backend: incident API, WebSocket broadcast, contact notification, ambulance dispatch, hospital workflow, live city view | FastAPI, WebSockets, React, Canvas |
| 3 | [`ai-model/`](ai-model) | Crash detection (threshold rules + ML) and AI severity rating (0–10) | Python, scikit-learn |
| 4 | [`simulation/`](simulation) | Generates phone sensor streams, trips, and crash signatures — plus a live **world simulator** (grid city, driving vehicles, scheduled crashes) | Python |
| 5 | [`data-analytics/`](data-analytics) | Read-only analytics service + website: red-zone hotspots, time patterns, severity distribution | FastAPI, React, Recharts |

## Run the live demo

```bash
# terminal 1 — backend + world simulator
cd hospital-website/backend && pip install -r requirements.txt
uvicorn app.main:app --port 8000

# terminal 2 — analytics service
cd data-analytics/service && pip install -r requirements.txt
uvicorn main:app --port 8001

# terminal 3 — hospital & emergency console
cd hospital-website/web && npm install && npm run dev      # http://localhost:5173

# terminal 4 — data analytics site
cd data-analytics/web && npm install && npm run dev        # http://localhost:5174
```

The console shows a living city: vehicles drive, a crash is detected and classified, contacts are
notified, an ambulance drives to the scene, and the incident lands in the feed. Switch **Scripted
demo / Random city** and change speed live. The analytics site builds red zones, hourly patterns,
and severity distributions from everything that has happened.

## System Flow

```
simulation ──▶ mobile-app ──▶ ai-model ──▶ hospital-website/backend ──▶ hospital-website/web
(sensor data) (alert payload) (crash+severity)   (events / WS / dispatch)   (live console)
                                                       │
                                                       └──▶ data-analytics (hotspots, patterns)
```

## Shared Contracts

[`contracts/`](contracts) defines the JSON message schemas exchanged between modules so the five
teams can integrate independently. See [`contracts/README.md`](contracts/README.md).

## Getting Started

Each part has its own README with setup and run instructions. Suggested start order:

1. `simulation` — generate a labeled scenario into `data/`
2. `ai-model` — run rules/severity on a generated window
3. `hospital-website/backend` — serve the alert API + WebSocket + world
4. `hospital-website/web` — watch live events
5. `data-analytics` — build hotspot/pattern analytics
6. `mobile-app` — play back a trip and trigger the flow end-to-end

## Demo Scenario

A deterministic, on-demand demo is provided by `simulation/scripts/generate_sample.py`, which
outputs a numbered trip with a scheduled crash that flows through the whole pipeline.
