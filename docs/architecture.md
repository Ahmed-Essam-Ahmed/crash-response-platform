# System Architecture

## Layers

1. **Mobile Application** — the phone-side client **and sensor source**. It reads the device
   accelerometer, gyroscope, and GPS into a sliding window of `sensor_sample`s (relative `t` plus
   absolute `occurred_at`), performs a lightweight preliminary check, calls the AI service, and
   assembles the emergency payload (geolocation, severity, medical profile, emergency contacts).
   For demos without hardware it replays a recorded trip.
2. **AI Model** — a standalone HTTP service (`POST /detect`) combining rule-based logic with a
   machine-learning veto to decide whether a crash occurred, and a severity estimator producing a
   0–10 score. It returns a `crash_detected` object that is exactly the hospital `POST /cases` body.
3. **Hospital Website (backend)** — receives detection triggers, persists incidents, offers each
   case to the nearest eligible hospital, escalates it until somebody accepts, broadcasts events in
   real time, simulates notifications, and runs ambulance dispatch.
4. **Hospital Website (frontend)** — multi-tenant responder console. Every hospital signs in to its
   own board of offered cases, active cases, resources, and team; nothing is shared between
   hospitals.
5. **Data Analytics** — read-only service over the incident store producing hotspot ("red zone")
   maps, temporal risk patterns, severity distributions, demographics, and hospital response times.
   It has no UI of its own; the **authority dashboard** is embedded in the hospital website and shown
   to users with the `authority` role (national oversight across all of Egypt).

## Team Ownership Mapping

| Layer(s) | Owned by part | Notes |
|----------|---------------|-------|
| 1 | mobile-app | Sensor source + thin client; heavy lifting stays server-side |
| 2 | ai-model | Standalone Python service: rules + ML + severity scoring |
| 3, 4 | hospital-website | Full-stack: event store, WebSockets, workflow, console |
| 5 | data-analytics | Separate read-only service; dashboard UI hosted in the hospital website (`authority` role) |

The end-to-end wiring between these layers is specified in
[`integration.md`](integration.md); the message shapes live in [`contracts/`](../contracts).

## Key Algorithms

- **Crash detection** — peak g-force and delta-V thresholds, ML veto for near-misses
  (hard braking, sharp turns, potholes).
- **Severity (0–10 AI / 1–10 clinical)** — weighted model over impact g-force, delta-V, impact
  type, speed at impact, post-crash inactivity, and medical context. The intake boundary clamps
  whatever the model sends into 1–10, so an upstream 0–10 (or higher) score is stored in range
  rather than rejected.
- **Road routing** — there is no road graph of our own. When a hospital accepts a case, the
  service asks OSRM (keyless, `router.project-osrm.org`) for the driving path from the hospital to
  the crash and back, and stores both legs on the incident. The two legs are fetched separately
  rather than reversed, because one-way streets mean the way back is not the way there. Progress
  along a leg is measured by distance, not by index, so the ambulance covers corners at a sensible
  speed instead of speeding up between them. If the router is unreachable, enabled off, or returns
  something that is not a route, the service falls back to the straight line — a case must never be
  undispatchable because a map server is down. Routes are cached in process by rounded coordinates.
- **Case escalation** — a hospital is eligible when its trauma level covers the case, it has a free
  bed, and it has a spare ambulance. The nearest eligible hospital is offered the case first; each
  expiry widens the candidate set, and after three stages the case is broadcast to every eligible
  hospital at once. Accepting a case assigns it; declining starts the next stage immediately.
- **Ambulance motion** — the progression loop advances an assigned ambulance along its stored road
  route every half second, interpolating by distance along the polyline for its current phase, then
  broadcasts the whole fleet as a `fleet_update` event. Positions are never stored per tick, so a
  reconnecting console gets the current state from the first event it sees.
- **Console map** — Leaflet with the standard OpenStreetMap raster tiles, chosen so there is no API
  key to provision. Dark mode re-tunes those tiles with a CSS filter instead of relying on a
  separate dark basemap, which keeps the map to a single provider. Markers, route polylines, and
  tile updates are all created and updated imperatively inside one `LiveMap` component, which is
  the only file that knows a map library is involved. Tile choice is not covered by the test suite
  because it needs the network; `scripts/check_basemap.py` verifies the pixels instead, since a
  key-gated tile server keeps returning `200`.
- **Analytics** — grid/DBSCAN hotspot aggregation for red zones; time-bucket analysis; severity
  distribution.

## Multi-tenancy

A hospital is the tenant boundary. A signed token carries the user's hospital id, and the
`/me` endpoints derive the hospital from that token rather than from a path parameter, so a request
cannot name a hospital it does not belong to. WebSocket events are filtered to the hospitals that
can see the case, and the connection itself is authenticated by the token in its query string.

Two consequences worth knowing:

- **Schema.** `cases` are scoped by `incidents.hospital_id`, teams by `users.hospital_id`, and
  ambulances by `ambulances.hospital_id`. A case is offered rather than assigned, so an offer row
  (`case_offers`) is what connects a case to a hospital before anybody accepts it.
- **Upgrades.** `create_all` only creates missing tables, so `app/migrations.py` adds new columns in
  place, backfills, and rebuilds any table still carrying a retired NOT NULL column — SQLite cannot
  relax that constraint otherwise. The migration inspects the connection it is already using, and
  `tests/test_migrations.py` builds a real legacy database to prove rows survive.

## Deployment Topology (dev)

- All parts run locally and communicate over HTTP/WebSocket.
- The **app is the sensor source**: it reads device sensors (or replays a recording), calls the AI
  service at `:7001`, and reports to the backend via `POST /cases`.
- The AI model runs as a **standalone HTTP service** (`POST /detect`); the app carries its result
  into the hospital boundary.
- The hospital console talks to the backend via REST (`/cases` to report, `/me` to work) and
  WS (`/me/stream`).
- Data analytics runs its own read-only service (port 8001) over the backend's SQLite database. It
  validates the caller's bearer token against the backend's `auth_tokens`/`users` and only serves the
  `authority` role. The dashboard UI ships inside the hospital website and calls this service
  directly.

See [`integration.md`](integration.md) for ports, the runtime sequence, failure fallbacks, and the
per-module implementation checklist.
