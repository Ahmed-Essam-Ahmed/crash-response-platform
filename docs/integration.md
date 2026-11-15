# End-to-End Integration Design

This document is the **integration contract and runtime plan** that turns the four
independently-built parts (app, ai-model, website, analytics) into one connected system. It is authoritative for *how the parts
talk*; each module's own README stays authoritative for *what it does internally*.

Everything here follows one rule:

> **The output of each stage is the input of the next stage, and nothing crosses a stage boundary
> except a message defined in [`contracts/`](../contracts).**

## 1. Design decisions (agreed)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Where the AI runs | **Standalone HTTP service** (`ai-model` on :7001). The app sends a sensor window, the service returns the detection + severity. |
| D2 | Where sensor data comes from | **The mobile-app** reads the phone's own sensors (accelerometer, gyroscope, GPS), with an in-app **recorded-trip replay** as fallback. There is no separate simulation service. |
| D3 | Timestamps | Keep **relative `t`** on samples for model math; add absolute **`occurred_at`** (ISO-8601 UTC) so downstream stored time is real. |
| D4 | Hospital → analytics | **Read-only SQLite** on the hospital DB, with the schema documented as a contract (no new API). |
| D5 | Severity scale | AI emits **0–10**; the hospital stores the clinical **1–10** scale and clamps across the boundary. |

## 2. Runtime topology

| Service | Port | Transport | Owns |
|---------|------|-----------|------|
| `mobile-app` (client) | — | REST client | **Sensor source + trigger**: device sensors → window → calls AI → `POST /cases` |
| `ai-model` (service) | 7001 | REST | `POST /detect` → detection + severity |
| `hospital-website/backend` | 8000 | REST + WebSocket | `POST /cases`, `/me/*`, `WS /me/stream` |
| `data-analytics/service` | 8001 | REST (read-only) | `/analytics/*` over `hospital.db` |
| `hospital-website/web` | 5173 | Browser | Console + authority dashboard |

Suggested env (defaults in each service's `config.py`, documented in the contract):

```
AI_SERVICE_URL=http://localhost:7001
HOSPITAL_URL=http://localhost:8000
INGEST_API_KEY=dev-ingest-key-change-me
DATABASE_URL=sqlite:///.../hospital-website/data/hospital.db
ANALYTICS_URL=http://localhost:8001
```

## 3. The pipeline

```
 ┌────────────────────────────────────────────────┐
 │ mobile-app  (device sensors → sliding window)   │
 │ accelerometer · gyro · GPS → sensor_sample      │
 └───────────────┬────────────────────────────────┘
                 │ ai_detect_request (window)
                 ▼
          ┌─────────────┐
          │  ai-model   │
          │    :7001    │
          └──────┬──────┘
                 │ crash_detected
                 ▼
 ┌────────────────────────────────────────────────┐
 │ mobile-app attaches patient/contacts, forwards  │
 │ POST /cases (X-Ingest-Key)                       │
 └───────────────┬────────────────────────────────┘
                 ▼
          ┌───────────────────┐
          │ hospital backend  │  persists incidents / events / offers
          │       :8000       │──── WS /me/stream ──▶ responder console :5173
          └─────────┬─────────┘
                    │ hospital.db (read-only)
                    ▼
          ┌───────────────────┐
          │  data-analytics   │── /analytics/* ──▶ authority dashboard
          │       :8001       │
          └───────────────────┘
```

Ownership stays exactly as before (mobile, ai, hospital, analytics); this design only adds the
**edges** between them. The app is both the **sensor source** and the **trigger**.

## 4. Stage-by-stage I/O

### 4.1 mobile-app sensor source  (`sensor_sample`)

- The app **owns the sensor input**: it reads the device accelerometer, gyroscope, and GPS and
  produces `sensor_sample` records at ~10 Hz, each carrying relative `t` **and** absolute
  `occurred_at`.
- When no real device is available (emulator/demo), the app **replays a recorded trip** — a bundled
  or downloaded array of `sensor_sample`s played back in real time. This is a client-side fallback,
  *not* a separate service.
- `schema_version` is required on every sample. The window sent to the AI is built from this stream.

### 4.2 mobile-app → ai-model  (`ai_detect_request`)

- From its own sensor stream the app keeps a **sliding window** (≥ 40 samples = 4 s at 10 Hz) per
  active trip, and on a preliminary rule hit (or every N samples) calls the AI service.
- Request (`contracts/schemas/ai_detect_request.schema.json`):

```json
{
  "schema_version": "1.0",
  "type": "ai_detect_request",
  "trip_id": "trip-0001",
  "occurred_at": "2026-11-16T13:22:41.300Z",
  "window": [ { "…": "sensor_sample[] ≥ 40" } ],
  "medical_context": { "age": 47, "conditions": ["Asthma"], "medical_risk": 0.0 }
}
```

- The app must **not** invent `ml_confidence`, `peak_g`, `delta_v_mps`, or `impact_type`; those
  come only from the AI service (removes the current hardcoded `0.97`/`frontal`).

### 4.3 ai-model → mobile-app  (`crash_detected`)

- New AI service endpoint `POST /detect` returns either
  `{ "detected": false, "near_miss": true }` or a full `crash_detected` object.
- The `crash_detected` object **is exactly the `POST /cases` body** (see §5), so the app forwards it
  unchanged after attaching patient/contacts. This kills the `factors` vs `impact_factors` drift,
  the nested-vs-top-level `ml_confidence`, and the missing `mechanism`/`occurred_at`.
- Offline `scripts/train.py` + `scripts/evaluate.py` remain; `evaluate.py` output stays
  `crash_detected[]` for batch analysis.

### 4.4 mobile-app → hospital  (`POST /cases`)

- Endpoint: `POST /cases`, header `X-Ingest-Key: <INGEST_API_KEY>`. The app replaces its current
  `POST /alerts` call (which 404s today).
- The app enriches the AI result with what only the phone knows: `patient`, `emergency_contacts`,
  `location_label`, and confirms `occurred_at`.
- Severity is already 0–10 from the AI; the hospital clamps to 1–10 and sets
  `severity_source: "ai"`, `severity_confidence` from the AI.

### 4.5 hospital → analytics  (read-only SQLite)

- No new transport: analytics opens `hospital.db` read-only and reads the documented tables.
- The **schema contract** (§7) is frozen; analytics must break loudly (not silently) if a required
  column disappears.

## 5. Canonical `crash_detected` / `POST /cases` body

```json
{
  "schema_version": "1.0",
  "type": "crash_detected",
  "trip_id": "trip-0001",
  "severity": 8.5,
  "severity_source": "ai",
  "severity_confidence": 0.97,
  "severity_summary": "Frontal impact at ~52 km/h, one patient trapped.",
  "mechanism": "Head-on collision at a junction; driver trapped by the legs.",
  "occurred_at": "2026-11-16T13:22:41.300Z",
  "location": { "lat": 30.043, "lon": 31.244 },
  "location_label": "Ring Road, north entrance",
  "detection": { "rule": true, "ml_confidence": 0.97 },
  "impact_factors": { "impact_type": "frontal", "peak_g": 9.1, "delta_v_mps": 13.4 },
  "patient": {
    "name": "Yasmin Fouad", "age": 47, "blood_type": "AB-", "sex": "female",
    "conditions": ["Asthma"], "medications": ["Salbutamol"], "allergies": ["Latex"],
    "notes": "Airway being managed."
  },
  "emergency_contacts": [
    { "name": "Hala Fouad", "relation": "sister", "phone": "+201000000001",
      "email": "hala@example.com", "primary": true }
  ]
}
```

Rules at this boundary:

- `impact_factors` is the canonical name. Backends may still accept `factors` as a deprecated
  alias, but producers must send `impact_factors`.
- `severity_confidence` is top-level (0–1); the AI's internal `detection.ml_confidence` is echoed
  but not the source of truth for the field.
- `mechanism` is required by the contract (falls back to `impact_factors.mechanism` server-side).
- `occurred_at` is required; the hospital must not silently substitute "now" when it is present.
- `sex` is canonical; the backend maps `sex → patient_profiles.gender` at intake (accept `gender`
  as an alias for backward compatibility).

## 6. End-to-end sequence (happy path)

1. The driver opens the app; it starts collecting device sensors into `sensor_sample`s carrying `t`
   + `occurred_at`.
2. The app buffers a sliding window and shows live g-force.
3. A crash signature is crossed → app sends `ai_detect_request` to `:7001/detect`.
4. AI service returns `crash_detected` with severity, mechanism, impact factors.
5. App attaches `patient` + `emergency_contacts`, `POST /cases` with the ingest key.
6. Backend stores the incident, offers it to the nearest eligible hospital, opens `WS /me/stream`.
7. Console accepts → ambulance dispatched → lifecycle progresses → incident closes.
8. Every write lands in `hospital.db`; the authority dashboard on `:8001` reflects it within the
   analytics cache TTL (2 s).

## 7. Analytics data contract (read-only SQLite)

Analytics may read **only** these tables/columns (full DDL contract lives in
[`contracts/README.md`](../contracts/README.md#analytics-database-contract)):

- `incidents(alert_id, trip_id, severity, severity_source, severity_confidence, severity_summary,
  mechanism, lat, lon, governorate, location_label, status, destination, hospital_id, patient_id,
  accepted_at, created_at, updated_at, closed_at, eta_scene_seconds, eta_hospital_seconds,
  distance_m)`
- `patient_profiles(id, full_name, age, blood_type, gender, conditions, medications, allergies,
  notes)`
- `hospitals(id, code, name)`
- `incident_events(id, incident_id, status, note, at_scene, created_at)`
- `case_offers(id, incident_id, hospital_id, stage, status, offered_at, expires_at, responded_at,
  responded_by)`
- `auth_tokens(user_id, token_hash, expires_at, revoked_at)`
- `users(id, email, role, is_active)`

Any change to these columns is a **breaking contract change** and must update this document + the
analytics service in the same PR.

## 8. Failure modes & fallbacks

| Failure | Behaviour |
|---------|-----------|
| No live sensors (emulator/demo) | App replays a recorded `sensor_sample` trip in real time so the pipeline still runs end-to-end. |
| AI service unreachable | App **does not fabricate** severity. It either retries, or sends a preliminary payload with `severity_source: "preliminary"` and `severity_confidence ≤ 0.3` so the backend can flag it. |
| Router (OSRM) down | Unchanged: hospital falls back to straight-line route (existing behaviour). |
| Analytics DB locked/missing | `/health` reports it; dashboard shows "analytics unavailable" (existing behaviour). |
| Duplicate delivery | `trip_id` + `occurred_at` identify a case; backend dedupes on `trip_id` within a short window (to add). |

## 9. Contract migration table (old → new)

| Where | Old | New |
|-------|-----|-----|
| mobile `api.ts` | `POST /alerts` | `POST /cases` + `X-Ingest-Key` |
| mobile `api.ts` | `factors` | `impact_factors` |
| mobile `api.ts` | hardcoded `ml_confidence: 0.97`, `impact_type: "frontal"` | from `ai-model` |
| mobile sensor input | bundled `scenario.json` (broken `src/assets` path), ground-truth label | device sensors → `sensor_sample` (relative `t` + `occurred_at`), with in-app recorded-trip replay fallback |
| ai `pipeline.py` | `factors` (no `impact_type`) | `impact_factors` incl. `impact_type` |
| ai `pipeline.py` | no `occurred_at` / `mechanism` | add both |
| ai `pipeline.py` | `detection.ml_confidence` only | also top-level `severity_confidence` |
| contracts | `POST /cases` `impact_factors` documented | now produced by AI verbatim |
| backend intake | `sex` dropped (reads `gender`) | map `sex → gender` |
| backend WS | docs `/stream` | actual `/me/stream` (document reality) |
| analytics filters | docs `date_from/date_to` | actual `from`/`to` (document reality) |

## 10. Per-module implementation checklist

**ai-model**
- Add `service/` FastAPI app: `POST /detect` (single window) + `GET /health`.
- Emit `impact_factors` with `impact_type`, plus top-level `severity_confidence`,
  `mechanism`, `occurred_at`.
- Load `models/crash_veto.joblib`; if absent, report `ml_confidence: null` (not `0.3`).
- Training/eval data now comes from **recorded device trips** (no simulation generator); keep
  `scripts/train.py` / `evaluate.py` but feed them captured `sensor_sample` arrays.

**mobile-app** (sensor source + trigger)
- Read device accelerometer/gyro/GPS → `sensor_sample` (relative `t` + `occurred_at`); add an
  in-app recorded-trip replay fallback for emulator/demo.
- Buffer windows; call `AI_SERVICE_URL/detect`; forward result to `POST /cases` with ingest key.
- Add patient + emergency-contacts profile (local storage); stop fabricating AI fields.
- Fix the broken `src/assets` → `assets` scenario path (replay fallback only).

**hospital backend**
- Accept `sex` (map → `gender`); enforce `schema_version`; keep `factors` alias.
- Dedupe on `trip_id`±window; persist `occurred_at` (do not overwrite with now).
- Publish a documented `case_opened` with `incident` (contract) or update the contract to match.

**data-analytics**
- No transport change. Add schema-drift detection (fail loudly on missing required column).
- Document `from`/`to` filter names and the read-only DB dependency.

## 11. Non-goals

- No separate simulation service; all sensor data originates on the app (device or replayed recording).
- No message broker (Kafka/RabbitMQ); WebSocket + REST only.
- No change to the multi-tenant auth model or escalation algorithm.
- No migration of analytics off SQLite in this iteration.
