# Hospital Response Console

Operator/hospital-facing web console for the hospital part.

## What it shows

- **Live map** — hospitals (colour-coded by trauma level, with free beds), ambulances moving in
  real time, and incidents pulsing by severity.
- **Active incidents** — severity, current status, destination, assigned units.
- **Hospital capacity** — occupancy bars and free beds per hospital.
- **Incident detail** — assignment, impact factors, and the full lifecycle timeline.
- **Report crash** — posts a test crash to `POST /incidents` so the whole pipeline can be
  exercised from the UI.

Everything updates from the WebSocket stream (`/stream`); a 4-second poll is a safety net.

## Run

```bash
npm install
npm run dev       # http://localhost:5173
```

Requires the backend on port 8000. Override with `VITE_API` and `VITE_WS` if it runs elsewhere.

## Layout

```
src/
  main.tsx / App.tsx      shell, data flow, layout
  api.ts                  REST client + WS url
  types.ts                payload types
  hooks/useStream.ts      WebSocket subscription with auto-reconnect
  components/
    MapCanvas.tsx         canvas map (hospitals, ambulances, incidents)
    IncidentBoard.tsx     active incident list + status pills
    IncidentDetail.tsx    timeline drawer
    HospitalPanel.tsx     capacity bars
```
