# Part 2 — Hospital Website · Web Console

The responder console for emergency operators and hospitals: a canvas game view of the live city
(vehicles, incidents, ambulances, hospitals), a live incident feed over WebSocket, and live
mode/speed controls. Analytics live in the separate [`data-analytics`](../../data-analytics) part.

## Ownership

Team member 2 (with [`../backend`](../backend)).

## Run

```bash
npm install
npm run dev       # opens http://localhost:5173
```

Requires the backend on port 8000 (see [`../backend`](../backend)).

## Layout

```
src/
  main.tsx / App.tsx          # shell + mode/speed controls
  types.ts                    # contract payload types
  api.ts                      # REST client (/alerts, /sim/config)
  hooks/useSocket.ts          # subscription to backend WS events
  components/
    CanvasView.tsx            # game view: roads, vehicles, incidents, ambulances
    IncidentFeed.tsx          # live event list
```
