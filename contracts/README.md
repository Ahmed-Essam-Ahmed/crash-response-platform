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
`POST /incidents`. See "The hospital service boundary" below for the accepted shape.

### Superseded events

The earlier `emergency_alert`, `dispatch_update`, and `vehicle_state` events belonged to the first
version of this platform. The hospital service has since been rebuilt around an explicit incident
lifecycle and now emits `incident_detected`, `incident_status`, `fleet_update`, and
`hospitals_update` instead — documented under "The hospital service boundary".

## REST Endpoints

### hospital-website/backend (port 8000)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/incidents` | Report a crash — **the upstream input boundary** |
| `GET`  | `/incidents` | List incidents |
| `GET`  | `/incidents/active` | Everything not yet closed |
| `GET`  | `/incidents/{alert_id}` | Detail with timeline |
| `POST` | `/incidents/{alert_id}/cancel` | Cancel an active incident |
| `POST` | `/incidents/{alert_id}/advance` | Move an incident to its next legal lifecycle state |
| `GET`  | `/hospitals` | Hospitals with capacity and load |
| `GET`  | `/hospitals/{code}/incoming` | Active incidents for a hospital |
| `GET`  | `/fleet` | Ambulances with live positions |
| `GET`  | `/health` | Liveness |
| `WS`   | `/stream` | Real-time events (alias `/ws`) |

### data-analytics/service (port 8001)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/analytics/summary` | Totals, hotspots, by-hour, severity distribution |
| `GET` | `/analytics/incidents` | Raw incidents (read-only) |
| `GET` | `/health` | Liveness + DB path |

## The hospital service boundary (provisional)

Each part is built independently and the shared contract is agreed at integration. These are the
shapes the hospital service currently accepts and emits.

### Input — `POST /incidents`

```json
{
  "trip_id": "trip-0001",
  "severity": 8.5,
  "location": { "lat": 30.043, "lon": 31.244 },
  "medical_profile_ref": "profile-0001",
  "detection": { "rule": true, "ml_confidence": 0.97 },
  "impact_factors": { "peak_g": 9.1, "delta_v_mps": 13.4, "impact_type": "frontal" }
}
```

Only `severity` and `location` are required; everything else is optional and echoed back on the
incident record.

### Output — `GET /incidents/{alert_id}`

```json
{
  "alert_id": "alert-27c72f79",
  "trip_id": "trip-0001",
  "severity": 8.5,
  "status": "en_route_to_hospital",
  "destination": "trauma_centre",
  "assignment": { "hospital_id": "hosp-01", "ambulance_ids": ["amb-021", "amb-022"] },
  "eta_scene_seconds": 73,
  "eta_hospital_seconds": 160,
  "impact_factors": { "peak_g": 9.1, "delta_v_mps": 13.4 },
  "created_at": "2026-09-28T21:55:02.113000",
  "closed_at": null,
  "events": [
    { "status": "detected", "note": "crash detected", "at_scene": false, "created_at": "..." }
  ]
}
```

### Output — WebSocket `/stream`

```json
{ "type": "incident_status", "alert_id": "alert-...", "status": "on_scene", "note": "paramedics on scene", "at": "..." }
{ "type": "fleet_update", "alert_id": "alert-...", "status": "en_route_to_scene", "ambulances": [{ "ambulance_id": "amb-021", "lat": 30.04, "lon": 31.24, "status": "en_route" }] }
{ "type": "hospitals_update", "hospitals": [{ "hospital_id": "hosp-01", "current_load": 2, "free_beds": 10 }] }
```

Lifecycle values: `detected`, `contacts_notified`, `ambulance_assigned`, `en_route_to_scene`,
`on_scene`, `en_route_to_hospital`, `at_hospital`, `closed`, `cancelled`.
