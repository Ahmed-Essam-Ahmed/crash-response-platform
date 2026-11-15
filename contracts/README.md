# Shared Contracts

This directory is the **firewall between the four modules** (app, ai-model, website, analytics). A module may change freely as long as
the messages it emits and accepts still validate against the schemas here. If a payload changes,
it changes here first.

> The integration plan that wires these contracts into one running system is
> [`docs/integration.md`](../docs/integration.md). This file defines the **messages**; that file
> defines the **edges**.

Machine-readable schemas live in [`schemas/`](schemas/):

- [`sensor_sample.schema.json`](schemas/sensor_sample.schema.json)
- [`ai_detect_request.schema.json`](schemas/ai_detect_request.schema.json)
- [`crash_detected.schema.json`](schemas/crash_detected.schema.json)

## Conventions

- Every payload carries `schema_version` (currently `"1.0"`). Messages without it are invalid.
- `type` names the event kind (`sensor_sample`, `ai_detect_request`, `crash_detected`, …).
- **Time.** Samples carry a **relative** `t` (seconds from trip start) *and* an absolute
  `occurred_at` (ISO-8601 UTC). Relative `t` is for model math; `occurred_at` is the wall-clock
  time the hospital stores.
- **Severity scale.** The AI emits **0–10**. The hospital stores the clinical **1–10** scale and
  clamps across the boundary (values outside are pulled to the nearest bound, never rejected).
- **Canonical field names** are listed in the [field reconciliation](#field-reconciliation) table.
  Producers must send the canonical name; consumers may accept documented aliases during the
  migration window.

## Pipeline

```
mobile-app                mobile-app                  ai-model
(device sensors ───────▶  (window in ai_detect_request) ──────▶ (crash_detected)
 sensor_sample)                  │                                │
                                 ▼                                │
                    mobile-app forwards ◀─────────────────────────┘
                    POST /cases
                           │
                    hospital ──hospital.db (read-only)──▶ data-analytics
```

Each stage's output is the next stage's input. No other channels exist. The **app owns the sensor
source**: `sensor_sample`s come from the phone's accelerometer/gyro/GPS (or an in-app recorded-trip
replay for demos), not from a separate simulation service.

---

## Events

### `sensor_sample`

Produced by the `mobile-app` sensor layer (device accelerometer/gyro/GPS, or a replayed recording) →
carried inside `ai_detect_request` to the `ai-model`, and reused as training/eval data.

```json
{
  "schema_version": "1.0",
  "type": "sensor_sample",
  "t": 12.4,
  "occurred_at": "2026-11-16T13:22:41.300Z",
  "trip_id": "trip-0001",
  "seq": 124,
  "gps": { "lat": 30.04442, "lon": 31.23571, "speed_mps": 14.2 },
  "accel": { "x": 0.12, "y": -0.03, "z": 9.71, "g": 1.01 },
  "gyro": { "x": 0.01, "y": 0.02, "z": -0.005 },
  "context": { "hour": 14, "weather": "clear", "road": "urban" }
}
```

- `t` — relative seconds from trip start (float).
- `occurred_at` — absolute ISO-8601 UTC timestamp of this sample.
- `accel.x/y/z` are in g; `accel.g` is the vector magnitude.
- `context` is free-form and may grow (weather, road class, …).

### `ai_detect_request`

Emitted by `mobile-app` → consumed by `ai-model` at `POST /detect`.

```json
{
  "schema_version": "1.0",
  "type": "ai_detect_request",
  "trip_id": "trip-0001",
  "occurred_at": "2026-11-16T13:22:41.300Z",
  "window": [ { "…": "sensor_sample[] — at least 40 samples (4 s @ 10 Hz)" } ],
  "medical_context": { "age": 47, "conditions": ["Asthma"], "medical_risk": 0.0 }
}
```

`medical_risk` is an optional 0–1 prior the app may supply from the patient profile; the AI folds it
into severity exactly as it does today.

### `ai_detect_response` (from `POST /detect`)

Either a non-detection:

```json
{ "schema_version": "1.0", "type": "ai_detect_response", "detected": false, "near_miss": true }
```

or a detection — in which case the `crash_detected` object below is returned and is **identical to
the `POST /cases` body**, so the app can forward it unchanged.

### `crash_detected` — also the `POST /cases` body

Emitted by `ai-model` → forwarded by `mobile-app` → consumed by the hospital service at `POST /cases`.

```json
{
  "schema_version": "1.0",
  "type": "crash_detected",
  "trip_id": "trip-0001",
  "severity": 8.5,
  "severity_source": "ai",
  "severity_confidence": 0.97,
  "severity_summary": "Frontal impact at ~52 km/h, one patient trapped.",
  "mechanism": "Head-on collision at a junction. The driver was behind the wheel and trapped by the legs.",
  "occurred_at": "2026-09-29T06:40:00Z",
  "location": { "lat": 30.043, "lon": 31.244 },
  "location_label": "Ring Road, north entrance",
  "detection": { "rule": true, "ml_confidence": 0.97 },
  "impact_factors": { "impact_type": "frontal", "peak_g": 9.1, "delta_v_mps": 13.4 },
  "patient": {
    "name": "Yasmin Fouad", "age": 47, "blood_type": "AB-", "sex": "female",
    "conditions": ["Asthma"], "medications": ["Salbutamol"],
    "allergies": ["Latex"], "notes": "Airway being managed."
  },
  "emergency_contacts": [
    { "name": "Hala Fouad", "relation": "sister", "phone": "+201000000001",
      "email": "hala@example.com", "primary": true },
    { "name": "Karim Fouad", "relation": "brother", "phone": "+201000000002" }
  ]
}
```

Boundary rules:

- `location` (`lat`, `lon`) is **required**; everything else is optional but recommended.
- `impact_factors` is canonical. `factors` is a **deprecated alias** the backend still accepts;
  producers must send `impact_factors`, including `impact_type`.
- `severity_confidence` is **top-level** 0–1. The AI's internal `detection.ml_confidence` is echoed
  for audit but is not the source of truth for this field.
- `severity_source` ∈ `ai` (default) | `preliminary` | `manual`. A `preliminary` payload from an app
  that could not reach the AI service must set `severity_confidence ≤ 0.3`.
- `mechanism` is required in practice; the hospital falls back to `impact_factors.mechanism` when
  absent.
- `occurred_at` is required. The hospital must not replace it with "now" when it is present.
- `sex` is canonical (`male`/`female`/`other`/`unknown`); the backend maps `sex → gender` at intake
  and still accepts `gender` as an alias.
- Contacts accept `name`/`full_name`, `relation`/`relationship`, `phone`/`phone_number`/`mobile`,
  and `primary`/`is_primary`. Order is preserved; the first is the primary contact.

---

## REST Endpoints

### ai-model (port 7001) — standalone service

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/detect` | Body `ai_detect_request` → `ai_detect_response` / `crash_detected` |
| `GET` | `/health` | Liveness + whether `models/crash_veto.joblib` is loaded |

Offline `ai-model/scripts/train.py` and `scripts/evaluate.py` remain for batch work; they are not
part of the live edge.

### hospital-website/backend (port 8000)

Everything a hospital sees is under `/me` and requires a bearer token; the token also carries that
hospital's id, so no request can name a hospital it does not belong to.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/cases` | Report a crash — **the upstream input boundary**, keyed by `x-ingest-key` |
| `POST` | `/auth/join` | Onboard a hospital, its first account, and its admin password |
| `POST` | `/auth/login` | Exchange email + password for a token (hospital users pass a workspace code) |
| `GET`  | `/auth/me` | Current user and hospital |
| `GET`  | `/auth/authority/overview` | National live map feed: every hospital, open case, and ambulance (`authority` only) |
| `GET`  | `/auth/authority/incidents/{alert_id}` | One case with its timeline for the national map (`authority` only) |
| `GET`  | `/auth/staff` | Team roster for the caller's hospital (staff) |
| `POST` | `/auth/staff/invitations` | Add a colleague — **admin password required** |
| `DELETE` | `/auth/staff/{user_id}` | Remove a colleague — **admin password required** |
| `GET`  | `/auth/review/registry` | Hospitals and pending claims, for the platform registry console (`X-Review-Key`) |
| `GET`  | `/me/cases` | Board: offers, assigned cases, and recently finished |
| `GET`  | `/me/cases/{alert_id}` | One case with its full timeline |
| `POST` | `/me/cases/{alert_id}/accept` | Take a case that is offered to this hospital |
| `POST` | `/me/cases/{alert_id}/decline` | Pass, which starts the next escalation stage |
| `POST` | `/me/cases/{alert_id}/advance` | Move to the next legal lifecycle state |
| `POST` | `/me/cases/{alert_id}/cancel` | Cancel a case this hospital holds |
| `GET`  | `/me/hospital` | This hospital's profile and capacity |
| `GET`  | `/me/beds` | Beds total, occupied, and free |
| `PATCH` | `/me/beds` | Set bed capacity — **admin password required** |
| `GET`  | `/me/fleet` | Ambulances with live positions |
| `PATCH` | `/me/fleet` | Resize the fleet — **admin password required** |
| `GET`  | `/geo/search` | Place search for the registration and case forms |
| `GET`  | `/health` | Liveness |
| `WS`   | `/me/stream` | Real-time events, token in the query string |

Role summary: `authority` is national oversight (no hospital) — a live map of the whole country plus
the read-only analytics service. `staff` is the single role for every hospital account. Staff act on
cases normally; sensitive changes — capacity, invitations, and removing a colleague — are confirmed
per action with the hospital admin password (`X-Admin-Password`), not by a role. Platform
administration is separate again: the `REGISTRY_REVIEW_KEY` only unlocks the hospital registry
(approve/reject claims and a read-only roster), never the map, cases, or capacity.

### data-analytics/service (port 8001)

Read-only, national. Authenticates a bearer token against the backend's `auth_tokens`/`users` and
only serves the `authority` role. Query params are repeatable list filters unless noted:
`region` (alias `governorate`), `hospital`, `sex`, `age_group`, `destination`, `status`; scalar
`from`, `to` (date or datetime; date-only `to` expands to end-of-day), `severity_min`,
`severity_max`.

> Note: the implementation reads `from`/`to`, not `date_from`/`date_to`. This document is now the
> source of truth and matches the code.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/analytics/filters` | Available filter values (regions, hospitals, sexes, …) |
| `GET` | `/analytics/summary` | Totals, hotspots, hourly/weekday/trend, severity, by-region, by-hospital, demographics, response times, distributions |
| `GET` | `/analytics/incidents` | Joined incidents (patient + hospital + events + offers), read-only, unpaginated |
| `GET` | `/health` | Liveness + DB path |

---

## WebSocket `/me/stream`

Connect with `?token=…`. Events are only delivered to hospitals that can see the case. The
**actual** vocabulary emitted by the backend is:

```json
{ "type": "case_opened",     "alert_id": "alert-...", "required_resources": { }, "at": "..." }
{ "type": "case_offered",    "alert_id": "alert-...", "incident": { }, "at": "..." }
{ "type": "case_escalated",  "alert_id": "alert-...", "incident": { }, "at": "..." }
{ "type": "case_unclaimed",  "alert_id": "alert-...", "at": "..." }
{ "type": "incident_status", "alert_id": "alert-...", "incident": { }, "at": "..." }
{ "type": "case_status",     "alert_id": "alert-...", "incident": { }, "at": "..." }
{ "type": "case_updated",    "alert_id": "alert-...", "incident": { }, "at": "..." }
{ "type": "case_closed",     "alert_id": "alert-...", "at": "..." }
{ "type": "fleet_update",    "alert_id": "alert-...", "ambulances": [ ] }
{ "type": "capacity_changed","beds_total": 14, "beds_occupied": 3, "at": "..." }
{ "type": "hospital_profile_changed", "at": "..." }
```

A reconnect re-syncs from `GET /me/cases`, so a client that misses an event still converges. The
console also polls as a baseline, so it stays correct with the socket down.

Lifecycle values: `detected`, `contacts_notified`, `ambulance_assigned`, `en_route_to_scene`,
`on_scene`, `en_route_to_hospital`, `at_hospital`, `closed`, `cancelled`.

> `case_opened` currently omits `incident`; the contract above documents the emitted shape. This is
> a known drift to reconcile (either add `incident` to the event or accept the lean form here).

---

## Hospital eligibility

A case is offered to the nearest hospital that can take it: trauma level sufficient for the case,
a free bed, and at least one spare ambulance. If nobody accepts before the offer window expires, the
next stage widens the candidate set until the case is broadcast to all eligible hospitals. An
incident that no hospital ever accepted keeps `hospital_id` null, which is the correct end state
rather than lost data.

---

## Analytics database contract

`data-analytics` reads the hospital SQLite file **read-only** (`mode=ro`, `PRAGMA query_only=ON`).
It depends on exactly these tables/columns. Renaming or dropping any of them is a **breaking**
change and must update this section and the analytics service in the same change.

| Table | Required columns |
|-------|------------------|
| `incidents` | `alert_id, trip_id, severity, severity_source, severity_confidence, severity_summary, mechanism, lat, lon, location_label, status, destination, hospital_id, patient_id, accepted_at, created_at, updated_at, closed_at, eta_scene_seconds, eta_hospital_seconds, distance_m` |
| `patient_profiles` | `id, full_name, age, blood_type, gender, conditions, medications, allergies, notes` |
| `hospitals` | `id, code, name` |
| `incident_events` | `id, incident_id, status, note, at_scene, created_at` |
| `case_offers` | `id, incident_id, hospital_id, stage, status, offered_at, expires_at, responded_at, responded_by` |
| `auth_tokens` | `user_id, token_hash, expires_at, revoked_at` |
| `users` | `id, email, role, is_active` |

`incidents.governorate` is optional (probed at read time; analytics falls back to nearest region).
Auth coupling: `token_hash` is SHA-256 hex, identical to the backend's `app/security.py`.

---

## Field reconciliation

| Concept | Canonical | Accepted aliases (migration) | Notes |
|---------|-----------|------------------------------|-------|
| Impact data | `impact_factors` | `factors` | AI + mobile must emit `impact_factors` with `impact_type` |
| Severity confidence | `severity_confidence` (top-level) | `detection.ml_confidence` (audit only) | — |
| Sex | `sex` | `gender` | Backend maps `sex → patient_profiles.gender` |
| Contact name | `name` | `full_name` | — |
| Contact relation | `relation` | `relationship` | — |
| Contact phone | `phone` | `phone_number`, `mobile` | — |
| Contact primary flag | `primary` | `is_primary` | — |
| Report endpoint | `POST /cases` | — | `POST /alerts` is removed |
| Stream endpoint | `WS /me/stream` | — | was documented as `/stream` |
| Date filters | `from` / `to` | — | was documented as `date_from` / `date_to` |

## Deprecated / removed

- `POST /alerts` — never existed on the backend; mobile must use `POST /cases`.
- `emergency_alert`, `dispatch_update`, `vehicle_state`, `incident_detected`, `incident_status`
  (as a *contract event*), `fleet_update` (as a *contract event*), `hospitals_update` — superseded.
  The live hospital vocabulary is the `/me/stream` list above.
- Any separate simulation/sensor-injection service — removed. Sensor data originates on the app
  (device sensors or an in-app recorded-trip replay); `vehicle_state`/`world_crash` are no longer
  produced.
