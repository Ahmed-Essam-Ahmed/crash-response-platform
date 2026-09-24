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
Emitted by `ai-model` (or preliminary in `mobile-app`) → consumed by `hospital-website/backend`.

```json
{
  "schema_version": "1.0",
  "type": "crash_detected",
  "trip_id": "trip-0001",
  "t": 1727184123.4,
  "location": { "lat": 30.04442, "lon": 31.23571 },
  "severity": 7.4,
  "factors": {
    "peak_g": 6.8,
    "delta_v_mps": 11.2,
    "impact_type": "frontal",
    "speed_at_impact_mps": 16.0,
    "post_crash_inactive": true
  },
  "medical_profile_ref": "profile-0001",
  "detection": { "rule": true, "ml_confidence": 0.97 }
}
```

### `emergency_alert`
Emitted by `hospital-website/backend` → broadcast to the console (WebSocket) and simulated to
contacts/hospitals.

```json
{
  "schema_version": "1.0",
  "type": "emergency_alert",
  "alert_id": "alert-0001",
  "status": "dispatched",
  "severity": 7.4,
  "location": { "lat": 30.04442, "lon": 31.23571 },
  "contacts_notified": ["mom", "primary"],
  "assignment": { "hospital_id": "hosp-03", "ambulance_id": "amb-02" },
  "created_at": 1727184123.5
}
```

### `dispatch_update`
Emitted by `hospital-website/backend` workflows → broadcast to the console.

```json
{
  "schema_version": "1.0",
  "type": "dispatch_update",
  "alert_id": "alert-0001",
  "ambulance_id": "amb-02",
  "eta_seconds": 214,
  "state": "en_route",
  "route": [[31.10, 30.05], [31.15, 30.06], [31.18, 30.05]]
}
```

### `vehicle_state`
Emitted by `simulation` (driven by the backend) → broadcast to the console.

```json
{
  "schema_version": "1.0",
  "type": "vehicle_state",
  "trip_id": "trip-0001",
  "lat": 30.04442,
  "lon": 31.23571,
  "speed_mps": 14.2,
  "status": "driving"
}
```

## REST Endpoints

### hospital-website/backend (port 8000)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/alerts` | Mobile-app / ai-model submits a crash payload |
| `GET`  | `/alerts` | List incidents |
| `POST` | `/sim/config` | Set world mode (`scripted`/`random`) and speed |
| `GET`  | `/sim/config` | Current world mode + speed |
| `GET`  | `/health` | Liveness |
| `WS`   | `/ws` | Real-time broadcast of all event types |

### data-analytics/service (port 8001)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/analytics/summary` | Totals, hotspots, by-hour, severity distribution |
| `GET` | `/analytics/incidents` | Raw incidents (read-only) |
| `GET` | `/health` | Liveness + DB path |

> Analytics is computed server-side in `data-analytics/service` from the backend's incident DB.