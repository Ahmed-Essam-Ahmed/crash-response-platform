# Shared Contracts

JSON message schemas exchanged between modules. All integration bugs live here — keep them in
sync. Every payload carries `schema_version` so modules can evolve independently.

## Events

### `sensor_sample`
Emitted by `simulation` → consumed by `mobile-app` / `ai-model`.

```json
{
  "schema_version": "1.0",
  "type": "sensor_sample",
  "t": 1727184000.0,
  "trip_id": "trip-0001",
  "seq": 128,
  "gps": { "lat": 30.04442, "lon": 31.23571, "speed_mps": 14.2 },
  "accel": { "x": 0.12, "y": -0.03, "z": 9.71, "g": 1.01 },
  "gyro": { "x": 0.01, "y": 0.02, "z": -0.005 },
  "context": { "hour": 14, "weather": "clear", "road": "urban" }
}
```

### `crash_detected`
Emitted by `ai-model` (or preliminary in `mobile-app`) → submitted to the hospital service via
`POST /cases`. See "The hospital service boundary" below for the accepted shape.

### Superseded events

The earlier `emergency_alert`, `dispatch_update`, and `vehicle_state` events belonged to the first
version of this platform, as did the admin-wide `incident_detected`, `incident_status`,
`fleet_update`, and `hospitals_update` events. The hospital service is now multi-tenant: a case is
*offered* to the nearest eligible hospital and escalates, so the live vocabulary is `case_opened`,
`case_escalated`, `case_unclaimed`, `case_status`, `offer_expired`, `fleet_update`, and
`capacity_changed`. Every event is scoped to the hospitals that can actually see the case.

## REST Endpoints

### hospital-website/backend (port 8000)

Everything a hospital sees is under `/me` and requires a bearer token; the token also carries that
hospital's id, so no request can name a hospital it does not belong to.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/cases` | Report a crash — **the upstream input boundary**, keyed by `x-ingest-key` |
| `POST` | `/auth/register` | Onboard a hospital and its first admin |
| `POST` | `/auth/login` | Exchange email + password for a token |
| `GET`  | `/auth/me` | Current user, role, and hospital |
| `GET`  | `/auth/staff` | Team roster for the caller's hospital (any role) |
| `POST` | `/auth/staff` | Add a colleague — **admin only** |
| `DELETE` | `/auth/staff/{user_id}` | Remove a colleague — **admin only** |
| `GET`  | `/me/cases` | Board: offers, assigned cases, and recently finished |
| `GET`  | `/me/cases/{alert_id}` | One case with its full timeline |
| `POST` | `/me/cases/{alert_id}/accept` | Take a case that is offered to this hospital |
| `POST` | `/me/cases/{alert_id}/decline` | Pass, which starts the next escalation stage |
| `POST` | `/me/cases/{alert_id}/advance` | Move to the next legal lifecycle state |
| `POST` | `/me/cases/{alert_id}/cancel` | Cancel a case this hospital holds |
| `GET`  | `/me/hospital` | This hospital's profile and capacity |
| `GET`  | `/me/beds` | Beds total, occupied, and free |
| `PATCH` | `/me/beds` | Set bed capacity — **admin only** |
| `GET`  | `/me/fleet` | Ambulances with live positions |
| `PATCH` | `/me/fleet` | Resize the fleet — **admin only** |
| `GET`  | `/geo/search` | Place search for the registration and case forms |
| `GET`  | `/health` | Liveness |
| `WS`   | `/stream` | Real-time events, token in the query string |

Role summary: `admin` manages the team and capacity, `dispatcher` acts on cases, `viewer` is
read-only. The service enforces this on every write; the console hides what a role cannot do.

### data-analytics/service (port 8001)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/analytics/summary` | Totals, hotspots, by-hour, severity distribution |
| `GET` | `/analytics/incidents` | Raw incidents (read-only) |
| `GET` | `/health` | Liveness + DB path |

## The hospital service boundary (provisional)

Each part is built independently and the shared contract is agreed at integration. These are the
shapes the hospital service currently accepts and emits.

### Input — `POST /cases`

Only `location` is required. The service generates `alert_id` and works out eligibility, so the
upstream model does not choose a hospital.

```json
{
  "trip_id": "trip-0001",
  "severity": 8.5,
  "severity_source": "ai",
  "severity_confidence": 0.97,
  "severity_summary": "Frontal impact, one patient trapped.",
  "location": { "lat": 30.043, "lon": 31.244 },
  "location_label": "Ring Road, north entrance",
  "occurred_at": "2026-09-29T06:40:00",
  "detection": { "rule": true, "ml_confidence": 0.97 },
  "impact_factors": { "impact_type": "frontal", "peak_g": 9.1, "delta_v_mps": 13.4 },
  "patient": { "name": "Yasmin Fouad", "age": 47, "blood_type": "AB-", "sex": "female",
               "conditions": ["Asthma"], "medications": ["Salbutamol"],
               "allergies": ["Latex"], "notes": "Airway being managed." }
}
```

### Output — `GET /me/cases`

Three lists, because a case is offered before it is accepted.

```json
{
  "offers": [
    { "offer_id": 12, "alert_id": "alert-27c72f79", "stage": 1, "broadcast": false,
      "status": "pending", "offered_at": "...", "expires_at": "...",
      "distance_m": 176.4, "eta_seconds": 46,
      "incident": { "...": "full incident, no events" } }
  ],
  "assigned": [ { "...": "incident with events" } ],
  "recent":   [ { "...": "up to 20 finished cases" } ]
}
```

An offer is only visible to the hospital it was made to, and only while it is `pending` and
unexpired. `stage` counts the escalation attempt; `broadcast` is true once the case is open to every
eligible hospital.

### Output — `GET /me/cases/{alert_id}`

```json
{
  "alert_id": "alert-27c72f79",
  "status": "en_route_to_hospital",
  "status_step": 5,
  "destination": "trauma_centre",
  "patient": { "name": "Yasmin Fouad", "age": 47, "blood_type": "AB-", "conditions": [] },
  "location": { "lat": 30.043, "lon": 31.244, "label": "Ring Road, north entrance",
                "maps_url": "https://www.google.com/maps/search/?api=1&query=...",
                "directions_url": "https://www.google.com/maps/dir/?api=1&destination=..." },
  "distance_m": 176.4,
  "assignment": { "accepted": true, "accepted_at": "...", "accepted_by": "riverside@demo.hospital",
                  "ambulance_ids": ["amb-021"] },
  "share_text": "Yasmin Fouad, 47, AB- — Ring Road, north entrance",
  "events": [ { "status": "detected", "note": "case received", "created_at": "..." } ]
}
```

`status_step` is the index in the lifecycle, which is what the console's progress rail renders;
`share_text` is pre-formatted so a dispatcher can hand a colleague the case in one tap.

### Output — WebSocket `/stream`

Connect with `?token=…`. Events are only delivered to hospitals that can see the case.

```json
{ "type": "case_opened",    "alert_id": "alert-...", "incident": { }, "at": "..." }
{ "type": "case_escalated", "alert_id": "alert-...", "incident": { }, "at": "..." }
{ "type": "case_unclaimed", "alert_id": "alert-...", "at": "..." }
{ "type": "case_status",    "alert_id": "alert-...", "incident": { }, "at": "..." }
{ "type": "offer_expired",  "alert_id": "alert-...", "at": "..." }
{ "type": "fleet_update",   "alert_id": "alert-...", "ambulances": [ ] }
{ "type": "capacity_changed", "beds_total": 14, "beds_occupied": 3, "at": "..." }
```

A reconnect re-syncs from `GET /me/cases`, so a client that misses an event still converges. The
console also polls as a baseline, which keeps it correct even with the socket down.

Lifecycle values: `detected`, `contacts_notified`, `ambulance_assigned`, `en_route_to_scene`,
`on_scene`, `en_route_to_hospital`, `at_hospital`, `closed`, `cancelled`.

## Hospital eligibility

A case is offered to the nearest hospital that can take it: trauma level sufficient for the case,
a free bed, and at least one spare ambulance. If nobody accepts before the offer window expires, the
next stage widens the candidate set until the case is broadcast to all eligible hospitals. An
incident that no hospital ever accepted keeps `hospital_id` null, which is the correct end state
rather than lost data.
