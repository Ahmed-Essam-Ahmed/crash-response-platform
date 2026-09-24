# System Architecture

## Layers

1. **Simulation Layer** — generates or replays speed, acceleration, rotation, and GPS data with
   realistic noise, plus contextual factors (time of day, weather), injects labeled crash
   signatures, and runs the live grid-city world.
2. **Mobile Application** — mimics phone-based crash detection: consumes the sensor stream,
   performs on-device preliminary detection, and assembles the emergency payload (geolocation,
   severity, medical profile).
3. **AI Model** — hybrid module combining rule-based logic with machine learning classification to
   decide whether a crash occurred, and a severity estimator producing a 0–10 score.
4. **Hospital Website (backend)** — receives detection triggers, persists incidents, broadcasts
   events in real time, simulates notifications, and runs ambulance dispatch + hospital assignment.
5. **Hospital Website (frontend)** — real-time responder console: vehicles, accidents, and response
   units on a canvas city view, with a live incident feed.
6. **Data Analytics** — read-only service over the incident store producing hotspot ("red zone")
   maps, temporal risk patterns, and severity distributions, surfaced in a dedicated analytics site.

## Team Ownership Mapping

| Layer(s) | Owned by part | Notes |
|----------|---------------|-------|
| 1 | simulation | Source of all movement and crash data |
| 2 | mobile-app | Thin client; heavy lifting stays server-side |
| 3 | ai-model | Pure Python: rules + ML + severity scoring |
| 4, 5 | hospital-website | Full-stack: event store, WebSockets, workflow, console |
| 6 | data-analytics | Separate read-only service + analytics site |

## Key Algorithms

- **Crash detection** — peak g-force and delta-V thresholds, ML veto for near-misses
  (hard braking, sharp turns, potholes).
- **Severity (0–10)** — weighted model over impact g-force, delta-V, impact type, speed at impact,
  post-crash inactivity, and medical context.
- **Dispatch** — shortest-path routing over a simulated road graph.
- **Analytics** — grid/DBSCAN hotspot aggregation for red zones; time-bucket analysis; severity
  distribution.

## Deployment Topology (dev)

- All parts run locally and communicate over HTTP/WebSocket.
- Mobile-app and the hospital console talk to the backend via REST (`/alerts`) and WS (`/ws`).
- The AI model is a library/in-process service consumed by the backend.
- Simulation writes labeled scenarios consumed by mobile-app (playback) and ai-model (training),
  and drives the live world in-process inside the backend.
- Data analytics runs its own read-only service (port 8001) over the backend's SQLite database.
