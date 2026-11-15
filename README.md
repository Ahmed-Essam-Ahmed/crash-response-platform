# Mobile Crash Detection & Intelligent Emergency Response Platform

A phone-based accident detection system with AI severity rating, real-time emergency coordination,
hospital workflows, and road-safety analytics. Inspired by Apple's Crash Detection and extended with
structured hospital coordination, emergency-contact notification, medical-profile transmission, and
hotspot analytics.

The **phone's own sensors are the source of truth**: the app reads the accelerometer, gyroscope, and
GPS, and for demos replays a recorded trip. There is no separate simulation service.

## Team & Module Ownership (4 parts)

| # | Part | Description | Tech |
|---|------|-------------|------|
| 1 | [`mobile-app/`](mobile-app) | Phone client **and sensor source**: reads device sensors, keeps a sliding window, calls the AI service, and submits the emergency payload (location, medical profile, severity) | React Native |
| 2 | [`ai-model/`](ai-model) | Standalone detection **service**: crash detection (threshold rules + ML) and AI severity rating (0–10) | Python, scikit-learn, FastAPI |
| 3 | [`hospital-website/`](hospital-website) | **Full-stack** response end: receives crash reports, runs the incident lifecycle (triage → dispatch → hospital → handover), and serves a live operator console | FastAPI, WebSockets, React, Canvas |
| 4 | [`data-analytics/`](data-analytics) | Read-only national analytics service + **authority dashboard** (embedded in the hospital website): red-zone hotspots, time patterns, severity distribution, demographics, response times | FastAPI, React, SVG charts |

## Run the demo

The hospital end already runs standalone (it self-generates cases while the app/ai wiring is being
connected):

```bash
# terminal 1 — hospital response service
cd hospital-website/backend && pip install -r requirements.txt
DEMO_SOURCE=on uvicorn app.main:app --port 8000

# terminal 2 — hospital console
cd hospital-website/web && npm install && npm run dev      # http://localhost:5173

# terminal 3 — analytics service
cd data-analytics/service && pip install -r requirements.txt
uvicorn main:app --port 8001
```

The analytics dashboard is **not a separate site** — it is embedded in the hospital website
(`http://localhost:5173`), reached by signing in with the national-authority account.

`DEMO_SOURCE=on` makes the hospital service generate its own crash reports every 8 seconds, so the
part can be demoed before the app feeds it. Drop it once the app + AI are wired.

The console shows a live map: a crash is reported, triaged, an ambulance is assigned and drives to
the scene, the patient is transported, and the incident closes — with the full timeline on the right
and hospital beds filling in real time. The authority dashboard builds red zones and hourly patterns
from the incidents the hospital service records.

### Authority account

| Email | Password | Role |
|-------|----------|------|
| `authority@egypt.gov` | `authority123` | `authority` (national, all of Egypt) |

Signing in with this account opens the national analytics dashboard instead of a single-hospital
console. The dashboard calls the analytics service (port 8001) with the same bearer token.

## System Flow

```
mobile-app ──ai_detect_request──▶ ai-model ──crash_detected──▶ mobile-app
(sensors)                          (:7001)        (severity)        │
                                                                     ▼
                               hospital-website ◀── POST /cases (X-Ingest-Key)
                                      │
                                      ├──▶ console (live map, timeline, beds)
                                      └──▶ data-analytics (read-only DB) ──▶ authority dashboard
```

Each part is built independently; the boundaries are defined in [`contracts/`](contracts) and the
end-to-end wiring plan is in [`docs/integration.md`](docs/integration.md).

## Shared Contracts

[`contracts/`](contracts) defines the JSON message schemas (with machine-readable
[schemas](contracts/schemas/)) exchanged between the four parts so they can be built and integrated
independently. See [`contracts/README.md`](contracts/README.md).

## Getting Started

Each part has its own README with setup and run instructions. Suggested start order:

1. `mobile-app` — run on a device/emulator (or replay a recorded trip); captures `sensor_sample`s
2. `ai-model` — run the detection service on :7001 (or train/evaluate on captured windows)
3. `hospital-website` — run it standalone with `DEMO_SOURCE=on`, then swap in the app's `POST /cases`
4. `data-analytics` — run the analytics service, then sign in as the national authority to view hotspot/pattern analytics

## Demo Scenario

A recorded trip bundled in the app (or captured from a device) contains a crash signature; it flows
through the app → AI → hospital → analytics pipeline. See [`docs/integration.md`](docs/integration.md)
for the full sequence.
