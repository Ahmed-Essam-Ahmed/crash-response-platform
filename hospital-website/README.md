# Part 2 — Hospital Website

The **response end** of the platform. It receives crash reports from the upstream detection part and
drives the whole emergency response: triage, ambulance dispatch, hospital assignment, and the
incident lifecycle until the patient is handed over.

Owned end-to-end by one team member.

```
hospital-website/
├── backend/        FastAPI service — the "end" (lifecycle, dispatch, realtime)
└── web/            React console — live map, incident board, hospital capacity
```

## How it fits the chain

```
upstream (simulation / AI)  ──POST /incidents──▶  hospital-website  ──▶  downstream (analytics)
                                     │
                                     └── WS /stream  ──▶  web console
```

The service is the integration boundary: it takes a crash report in and emits incident status,
fleet movement, and hospital load out.

## Run

```bash
# backend (port 8000)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# console (port 5173)
cd web
npm install
npm run dev
```

Set `DEMO_SOURCE=on` to have the service generate its own crash reports every 12s — useful for
demos and for testing this part in isolation, before the upstream part is wired up.

## Tests

```bash
cd backend
python -m unittest discover -s tests -t .
```

Covers the lifecycle state machine, triage thresholds, hospital/ambulance selection, and
resource reservation/release.
