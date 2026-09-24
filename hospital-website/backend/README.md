# Part 2 — Hospital Website · Backend

Centers the system: receives crash payloads from the AI/mobile layers, persists incidents,
broadcasts real-time events over WebSocket, simulates emergency-contact notification, and runs the
ambulance/hospital workflow simulation. Owned by the hospital-website member (full-stack).

## Ownership

Team member 2 (with [`../web`](../web)).

## Responsibilities

- REST API: submit incidents (`POST /alerts`), query incidents.
- Real-time WebSocket (`/ws`) broadcasting `emergency_alert`, `dispatch_update`, `vehicle_state`.
- Invoke `ai-model` on incoming sensor streams (optional integration point).
- Simulated emergency-contact notification (message + call).
- Ambulance dispatch (shortest path over a simulated road graph) and hospital assignment.

## Run

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

On startup the backend also starts the **live world simulator** (`app/sim/controller.py`), which
ticks `simulation/world`, feeds crash windows to `ai-model`, and publishes real `emergency_alert`
events over WebSocket. Control it live:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/sim/config` | `{ "mode": "scripted" \| "random", "speed": 1..8 }` |
| `GET`  | `/sim/config` | Current mode + speed |
| `GET`  | `/sim/connections` | Number of connected dashboard clients |

Endpoints — see [`contracts/README.md`](../../contracts/README.md).

## Layout

```
app/
  main.py                 # FastAPI app + CORS + router mounting + world task
  db.py                   # SQLAlchemy engine/session (SQLite for dev)
  models.py               # Incident, Contact, Assignment records
  sim/
    controller.py         # drives simulation world -> ai-model -> alerts
  routers/
    alerts.py             # POST/GET /alerts
    streams.py            # WS /ws broadcast manager
    sim.py                # /sim/config controls
  services/
    alert_service.py      # shared alert creation (used by route + simulator)
    detection_client.py   # optional: calls ai-model library
    notifications.py      # simulates message/call to emergency contacts
  workflows/
    dispatch.py           # ambulance routing + ETA
    hospitals.py          # hospital capacity + assignment
```