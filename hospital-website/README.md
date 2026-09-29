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

To fill the board with cases that carry the full clinical picture — how the crash happened, a
severity on the 1–10 scale, patient details, and emergency contacts — post them through the real
intake endpoint:

```bash
cd backend
python scripts/seed_demo_cases.py            # all five
python scripts/seed_demo_cases.py --count 2  # just the two nearest
```

The cases land as live offers, so signing in as `riverside@demo.hospital` and accepting one shows
the ambulance moving on the map towards that crash.

## Tests

`python scripts/check_basemap.py` is kept out of the suite on purpose, because it needs the
network. It confirms the basemap is still serving a map rather than a placeholder.


```bash
cd backend
python -m unittest discover -s tests -t .
```

Covers the lifecycle state machine, triage thresholds, hospital/ambulance selection, and
resource reservation/release, plus the legacy-schema migration and the intake contract for
mechanism, emergency contacts, and severity clamping.

