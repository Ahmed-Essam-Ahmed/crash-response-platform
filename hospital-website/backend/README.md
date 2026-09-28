# Hospital Response Service

FastAPI service that owns the emergency response workflow.

## Architecture

```
app/
├── main.py            app + lifespan (seed registry, start background tasks)
├── config.py          env-driven settings
├── db.py              SQLAlchemy engine/session
├── models.py          Hospital, Ambulance, Incident, IncidentEvent, Contact
├── serializers.py     model → dict for REST and WebSocket
├── realtime.py        WebSocket connection manager
├── domain/            pure logic, no framework
│   ├── lifecycle.py   incident state machine + legal transitions
│   ├── triage.py      severity → destination + required resources
│   └── geo.py         distance, ETA, interpolation
├── services/          orchestration
│   ├── registry.py    seed hospitals/ambulances, contacts
│   ├── intake.py      crash report → incident (notify + dispatch)
│   ├── dispatch.py    hospital and ambulance selection, reserve/release
│   ├── progression.py background loop that advances incidents over time
│   ├── notifications.py  simulated contact notification
│   └── demo_source.py optional self-generating crash reports (DEMO_SOURCE=on)
└── routers/
    ├── incidents.py   report / list / detail / cancel
    ├── hospitals.py   list / detail / incoming
    ├── fleet.py       ambulances
    └── stream.py      WebSocket /stream
```

The domain layer has no FastAPI or SQLAlchemy imports, so the rules are testable in isolation.

## Incident lifecycle

```
detected → contacts_notified → ambulance_assigned → en_route_to_scene
        → on_scene → en_route_to_hospital → at_hospital → closed
```

`cancelled` is reachable from any state before `at_hospital`. Illegal transitions raise
`InvalidTransition` (409 on the API). Every transition is written to `incident_events`, giving the
incident a full audit timeline.

## Triage

| Severity | Destination | Ambulances | Trauma bay |
|----------|-------------|------------|------------|
| ≥ 8.0 | trauma_centre | 2 | yes |
| ≥ 5.5 | major | 1 | no |
| < 5.5 | minor | 1 | no |

Trauma cases only go to hospitals with `trauma_level >= 3`. Otherwise the nearest hospital with a
free bed wins; if none has beds, the nearest accepting hospital is used anyway.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/incidents` | Report a crash → creates the incident and dispatches |
| `GET` | `/incidents` | List incidents (`?status=`, `?limit=`) |
| `GET` | `/incidents/active` | Everything not yet closed |
| `GET` | `/incidents/{alert_id}` | Detail with full timeline |
| `POST` | `/incidents/{alert_id}/cancel` | Cancel an active incident |
| `GET` | `/hospitals` | Hospitals with capacity and load |
| `GET` | `/hospitals/{code}` | One hospital |
| `GET` | `/hospitals/{code}/incoming` | Active incidents heading to a hospital |
| `GET` | `/fleet` | All ambulances with live positions |
| `GET` | `/fleet/available` | Idle units |
| `WS` | `/stream` (alias `/ws`) | Real-time event stream |
| `GET` | `/health` | Liveness |

## Stream events

| Type | Emitted when |
|------|--------------|
| `incident_detected` | A crash is accepted, with the resources triage requires |
| `incident_status` | Any lifecycle transition |
| `fleet_update` | An assigned ambulance moves |
| `hospitals_update` | Occupancy changed |

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `sqlite:///.../hospital-website/data/hospital.db` | Any SQLAlchemy URL |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `TIME_SCALE` | `8.0` | Time compression for the demo (higher = faster) |
| `DEMO_SOURCE` | `off` | `on` generates a crash report every 12s |

## Run

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
