# Part 2 — Hospital Website (full-stack)

The responder-facing system, owned end-to-end by one team member. It contains:

- [`backend/`](backend) — FastAPI service: incident store, WebSocket broadcast, contact
  notification, ambulance dispatch, hospital assignment, and the live world controller.
- [`web/`](web) — React console: canvas city view, live incident feed, mode/speed controls.

## Run

```bash
# backend (port 8000)
cd backend && pip install -r requirements.txt && uvicorn app.main:app --port 8000

# console (port 5173)
cd web && npm install && npm run dev
```

See [`backend/README.md`](backend/README.md) and [`web/README.md`](web/README.md) for details.
Analytics are a separate part: [`../data-analytics`](../data-analytics).
