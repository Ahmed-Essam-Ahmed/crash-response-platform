# Hospital console

The live view an emergency department member actually uses. Plain language instead of status
codes, one obvious next action per case, and no technical jargon in the default view.

Each hospital signs in to its own console. Nothing in this app is shared between hospitals: the
board, the team, the fleet, and the cases are all scoped to the signed-in account.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API` | `http://localhost:8000` | Hospital service base URL |

`VITE_WS` is derived from `VITE_API` (`http` → `ws`, `https` → `wss`) so a console can never open
a socket to a different origin than the one it authenticates against.

## Getting in

A hospital that is not registered yet starts on the sign-in screen and switches to registration.
Registration is four short steps — hospital, place, capacity, first admin — because a place search
over a network is the slowest part of onboarding, so it is not blocking the steps after it. The
place field accepts a search or pasted coordinates, and the app works with no Google Maps key.

The backend seeds three demo hospitals on an empty database. Their codes changed once during
development, so the seeder matches a known hospital by name when the code does not match; otherwise
an upgraded database would silently lose its demo logins.

## Foundations

**Colour is OKLCH.** Perceptually uniform, so one scale reads evenly across hues and both themes
stay balanced instead of one feeling heavier than the other. Light and dark live in a single
`light-dark()` declaration rather than two mirrored blocks, so a token can never drift out of sync
between themes.

**Tokens, not one-offs.** Components reference semantic tokens (`--surface`, `--ink`, `--muted`,
`--sev-critical`) and never a raw colour. Severity is resolved by a `data-tone` attribute that sets
`--tone` and `--tone-ink`, so a card, its chip, and its progress rail stay consistent from one
source. Repointing the palette means editing one block in `index.css`.

**Fluid type, not breakpoints.** Sizes are `clamp()` expressions in `@theme`, so headings scale
continuously between 19px and 24px across viewports instead of jumping at a breakpoint. Body text
never drops below 16px.

**Container queries, not viewport queries.** The incident card is a query container, so its
internal layout responds to the space it is actually given. The same card works in a wide column,
a narrow column, or a future sidebar without a single media query.

**Verified contrast, both themes.** Checked by rendering the real console and resolving every text
colour through a canvas, including the OKLCH ones a naive parser gets wrong. Zero AA failures in
either theme, at every width tested.

## Motion

Uses **Motion** (`motion/react`), built on springs rather than fixed durations, because springs
settle naturally when a value changes mid-flight instead of snapping.

- Cases enter, exit, and **reorder with layout animation** when severity changes their position.
- The filter pill slides between tabs with a shared `layoutId`.
- The details sheet springs in from the right and closes on a short tween, backdrop fades. The close
  is a tween on purpose: a spring's asymptotic tail keeps an off-screen element mounted for roughly
  800ms, and the sheet is already off-screen well before then.
- Capacity bars and progress rails grow to their new value.
- Live indicator pulses; spinners rotate; buttons and cards compress on press.
- `prefers-reduced-motion: reduce` collapses every animation and transition to ~0s, and entrance
  animations are skipped rather than merely shortened.

Motion is used to explain what changed, not to decorate. Nothing loops except the live pulse.

## Interaction layer

Deliberately restrained. A board someone reads in an emergency should react to the pointer without
moving under it, so the interaction layer is one effect and nothing else.

- **Cursor spotlight.** A card tracks the pointer and drives a soft radial highlight via `--mx` /
  `--my`. `useHoverFx` writes the variable to the inner element rather than the motion node, so it
  cannot fight the card's entrance and reorder animations.
- **No tilt, no magnetic pull, no moving border.** An earlier build pulled buttons toward the
  cursor and spun a conic gradient around focused cards. Both were removed: a control that slides
  away from the pointer, or a border that keeps animating on a screen someone is trying to read, is
  motion that competes with the task. The focus ring is instant for the same reason.
- A count-up on the stat tiles is the only other pointer-adjacent effect.
- `prefers-reduced-motion: reduce` disables the spotlight and every transition.

## Responsiveness

Verified at 320, 390, 768, 1440, and 2560px: **zero horizontal overflow at any width**, and no
interactive target under the WCAG 2.2 minimum of 24px. The board moves 1 → 2 → 4 columns, the
sidebar becomes sticky on wide screens, and labels collapse on small ones.

## Accessibility

- Skip link to the case board
- Visible focus ring on every interactive element for keyboard users. The ring does not transition:
  Tailwind's `transition-colors` includes `outline-color`, which would fade the indicator in from the
  element's text colour and briefly dip below the required contrast.
- Every control's accessible name contains its visible label, so voice-control users can say what
  they see.
- `aria-live` announcements for new cases and for the open-case count
- `role="progressbar"` with values on each case's progress rail
- Filter tabs are a real `tablist`; trauma level and staff access are real `radiogroup`s
- `role="dialog"` + `aria-modal` on both sheets, focus moved in on open, restored on close
- Body scroll locks while a sheet is open. The close callback is memoised, because an inline
  callback would re-run the focus and scroll effects on every poll and make the sheet flicker.
- `prefers-reduced-motion: reduce` skips entrance animations outright

## Behaviour

State comes from a REST poll every 20 seconds as a reliable baseline, then live WebSocket events
patch it on top for immediacy. Both paths are idempotent, so a reconnect cannot duplicate a case.

| Control | Request |
|---|---|
| Accept this case | `POST /me/cases/{alert_id}/accept` |
| Pass | `POST /me/cases/{alert_id}/decline` |
| Primary action on a card | `POST /me/cases/{alert_id}/advance` |
| Cancel this case | `POST /me/cases/{alert_id}/cancel` |
| Details | `GET /me/cases/{alert_id}` (full timeline) |
| Team | `GET/POST/DELETE /auth/staff` |
| Capacity | `PATCH /me/beds`, `PATCH /me/fleet` |
| Register | `POST /auth/register` |

A case is offered to the nearest hospital that can take it, so the board has three lists: cases
offered to you, cases you are working, and what you have recently finished. Skeletons stand in
during load so the board never flashes empty. Filter tabs narrow the board to all, critical, or
arriving patients.

**Roles are enforced in the interface, not just the API.** A viewer is shown the board, the maps,
the patient details, and the team roster, but no accept, pass, advance, cancel, or capacity
controls; a dispatcher gets the case actions but not the team or capacity editors. The service
rejects those writes regardless, so the point of hiding them is that the console never offers an
action that is going to be refused.

## Structure

```
src/
  App.tsx                 theme, auth gate
  auth.tsx                token storage, session, 401 handling
  api.ts                  hospital service client
  types.ts                response and event types
  index.css               OKLCH tokens, fluid type, component layer, interaction layer
  lib/status.ts           status -> plain language, severity words, tones
  lib/format.ts           relative times, ETAs, distance, crash time, impact facts
  lib/useStream.ts        token-scoped websocket with reconnect backoff
  lib/useHoverFx.ts       pointer spotlight for a surface
  lib/clipboard.ts        copy-with-feedback helper
  lib/viewTransition.ts   View Transition wrapper with a no-op fallback
  components/             AuthScreen, Console, TopBar, StatRow, OfferCard,
                          IncidentCard, Stepper, DetailSheet, LiveMap,
                          CaseFacts, ResourcePanel, StaffSheet, Button, Toaster
```

## The live map

`LiveMap` is a real slippy map, not a schematic. It uses Leaflet directly with the standard
OpenStreetMap raster tiles, so there is no API key, no billing, and no quota to run out during a
demo. Dark mode does not use a second basemap; it inverts and re-tunes the same tiles with a CSS
filter, so a second provider can never half-work.

It draws four things: this hospital as a fixed `H` pin, every live case as a `!` pin coloured by
severity tone, every in-service ambulance as an `A` pin that turns red and gains a `+` while it is
moving, and a dashed line between the hospital and the crash for each case the hospital has taken.
Ambulance positions come from the `fleet_update` stream event, which the backend emits every half
second, so the pins move on their own without polling.

The map fits every layer once on first load and then leaves the view alone, because a dispatcher
panning to a case should not have the viewport yanked back by the next position update. Selecting a
case flies to its pin instead.

The whole map is confined to `LiveMap` so swapping in a paid provider later touches one file.

**Check the basemap is still a map.** A tile server that starts requiring a key does not fail
loudly: it answers `200` with a small placeholder image, and every request looks healthy.

```bash
cd backend
python scripts/check_basemap.py
```

It reads the pixels rather than trusting the status code. A placeholder is one flat colour with a
little text in it; a real tile is hundreds of colours. This check exists because the map was
originally pointed at CARTO, which passed every status-code check while showing nothing but
"API key required" on the map.

