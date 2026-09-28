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
| 2 | [`hospital-website/`](hospital-website) | **Full-stack** response end: receives crash reports, runs the incident lifecycle (triage → dispatch → hospital → handover), and serves a live operator console | FastAPI, WebSockets, React, Canvas |
| 3 | [`ai-model/`](ai-model) | Crash detection (threshold rules + ML) and AI severity rating (0–10) | Python, scikit-learn |
| 4 | [`simulation/`](simulation) | Generates phone sensor streams, trips, and crash signatures — plus a live **world simulator** (grid city, driving vehicles, scheduled crashes) | Python |
| 5 | [`data-analytics/`](data-analytics) | Read-only analytics service + website: red-zone hotspots, time patterns, severity distribution | FastAPI, React, Recharts |

## Run the live demo

```bash
# terminal 1 — hospital response service
cd hospital-website/backend && pip install -r requirements.txt
DEMO_SOURCE=on uvicorn app.main:app --port 8000

# terminal 2 — hospital console
cd hospital-website/web && npm install && npm run dev      # http://localhost:5173

# terminal 3 — analytics service
cd data-analytics/service && pip install -r requirements.txt
uvicorn main:app --port 8001

# terminal 4 — analytics site
cd data-analytics/web && npm install && npm run dev        # http://localhost:5174
```

`DEMO_SOURCE=on` makes the hospital service generate its own crash reports every 12 seconds, so the
part can be demoed standalone. Drop it once the upstream part feeds it.

The console shows a live map: a crash is reported, triaged, an ambulance is assigned and drives to
the scene, the patient is transported, and the incident closes — with the full timeline on the
right and hospital beds filling in real time. The analytics site builds red zones and hourly
patterns from the incidents the hospital service records.

## System Flow

```
simulation ──▶ mobile-app ──▶ ai-model ──▶ hospital-website ──▶ data-analytics
(sensor data) (alert payload) (crash+severity)  (lifecycle + dispatch)  (hotspots, patterns)
                                                 │
                                                 └──▶ console (live map, timeline, beds)
```

Each part is built independently and the shared contract is agreed at integration time — see
[`contracts/`](contracts) for the current boundary shapes.

## Shared Contracts

[`contracts/`](contracts) defines the JSON message schemas exchanged between modules so the five
teams can integrate independently. See [`contracts/README.md`](contracts/README.md).

## Getting Started

Each part has its own README with setup and run instructions. Suggested start order:

1. `simulation` — generate a labeled scenario into `data/`
2. `ai-model` — run rules/severity on a generated window
3. `hospital-website` — run it standalone with `DEMO_SOURCE=on`, then swap in real upstream input
4. `data-analytics` — build hotspot/pattern analytics
5. `mobile-app` — play back a trip and trigger the flow end-to-end

## Demo Scenario

A deterministic, on-demand demo is provided by `simulation/scripts/generate_sample.py`, which
outputs a numbered trip with a scheduled crash that flows through the whole pipeline.
