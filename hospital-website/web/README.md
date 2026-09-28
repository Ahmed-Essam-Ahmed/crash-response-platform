# Hospital console

The live view an emergency department member actually uses. Designed to be readable at a glance
under pressure: plain language instead of status codes, one obvious next action per case, and no
technical jargon anywhere in the default view.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API` | `http://localhost:8000` | Hospital service base URL |
| `VITE_WS` | `ws://localhost:8000/stream` | Live update socket |

## Design

Built on **Tailwind CSS v4** with a small token layer, so both themes come from one source of
truth.

- **Light and dark**, defaulting to the operating system preference and remembered per browser in
  `localStorage`.
- One screen, one job: *what needs you now*. Cases are large cards sorted by severity.
- **Plain language.** `en_route_to_scene` is never shown. The card reads "Ambulance is driving to
  the crash", and severity is a word (`Mild`, `Moderate`, `Serious`, `Critical`) rather than a
  number. Raw codes and decimals are kept in the details sheet for people who want them.
- **One primary action per case**, derived from the incident's position in the lifecycle, so the
  correct thing to do is always the most prominent thing on the card.
- A thin progress bar shows how far the case has travelled, with the current stage named in words.
- Live status is a single dot with a soft pulse. It turns amber and reads "Reconnecting" if the
  socket drops, and reconnects with backoff.
- The map is supporting context, not the main event.
- Tap targets are at least 32px, and the layout collapses cleanly to a single column on a phone.

## Behaviour

State comes from a REST poll every 5 seconds for a reliable baseline, then live WebSocket events
patch it on top for immediacy. Both paths are idempotent, so a reconnect can never duplicate a
case.

Actions call the hospital service and refresh immediately:

| Button | Request |
|---|---|
| Primary action on a card | `POST /incidents/{alert_id}/advance` |
| Cancel this call | `POST /incidents/{alert_id}/cancel` |
| Report a crash | `POST /incidents` |
| Details | `GET /incidents/{alert_id}` (full event history) |

The details sheet slides in from the right, closes on `Escape` or a click outside, and shows the
sensor findings plus the complete event timeline.

## Structure

```
src/
  App.tsx                 state, polling, stream handling
  api.ts                  hospital service client
  theme.tsx               light/dark context
  lib/status.ts           status -> plain language, severity words, tones
  lib/format.ts           relative times and ETAs
  lib/useStream.ts        websocket with reconnect backoff
  components/             TopBar, StatRow, IncidentCard, Stepper, MiniMap,
                          CapacityPanel, DetailSheet
```
