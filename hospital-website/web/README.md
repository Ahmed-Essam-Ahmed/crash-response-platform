# Hospital console

The live view an emergency department member actually uses. Plain language instead of status
codes, one obvious next action per case, and no technical jargon in the default view.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API` | `http://localhost:8000` | Hospital service base URL |
| `VITE_WS` | `ws://localhost:8000/stream` | Live update socket |

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

**Verified contrast, both themes.** Body text 16.5:1 light / 17.9:1 dark, muted 6.0:1 / 8.2:1,
chips 6.0:1 / 7.2:1, primary button 5.5:1 / 7.4:1. All pass WCAG AA.

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

Hover is the primary way to read the board, so every surface reacts to the pointer.

- **Cursor spotlight and tilt.** Cards track the pointer, driving a radial highlight via `--mx` /
  `--my` and a `rotateX` / `rotateY` lift. `useHoverFx` writes the transform to the inner element
  rather than the motion node, so it cannot fight the card's entrance and reorder animations.
- **Magnetic buttons.** Primary actions pull toward the cursor, clamped to 9px. Two details matter:
  the offset is measured against the button's **resting** rect, otherwise each move re-measures an
  already-transformed box and the effect cancels itself to zero; and the hit area is expanded 14px
  on a wrapper, otherwise the pull pushes the button out from under the cursor and hover flickers.
- **Flowing border.** `@property --border-angle` registers the angle as a genuinely animatable
  value, which is what lets a conic gradient travel around the border instead of snapping between
  positions. It degrades to a static border when motion is reduced.
- **Sheen sweep** across buttons on hover, and a count-up on the stat tiles.
- **Aurora and grain.** Three blurred, slowly drifting colour fields plus a fine noise layer, so
  large flat areas stop reading as dead. Both are decorative and hidden from assistive tech.
- **View Transitions** animate discrete state changes such as switching filters, as a progressive
  enhancement that falls back to an instant update.

## Responsiveness

Verified at 320, 390, 768, 1024, 1280, 1440, 1920, and 2560px: **zero horizontal overflow at any
width**, no text below 10.5px, and no interactive target under 40px. Layout moves 1 → 2 → 4
columns, the sidebar becomes sticky on wide screens, and labels collapse on small ones. The
magnetic hit area is absolutely positioned, so it never contributes to layout or scroll width.

## Accessibility

- Skip link to the case board
- Visible focus ring on every interactive element for keyboard users. The ring does not transition:
  Tailwind's `transition-colors` includes `outline-color`, which would fade the indicator in from the
  element's text colour and briefly dip below the required contrast.
- Every control's accessible name contains its visible label, so voice-control users can say what
  they see. The report button derives its name from its own text rather than a separate `aria-label`.
- `aria-live` announcements for new cases and for the open-case count
- `role="progressbar"` with values on each case's progress rail
- `role="dialog"` + `aria-modal` on the sheet, focus moved in on open, restored on close
- Body scroll locks while the sheet is open
- `prefers-reduced-motion: reduce` disables the aurora drift, the border spin, the sheen, and all
  tilt and magnetic movement, and skips entrance animations outright

## Behaviour

State comes from a REST poll every 5 seconds as a reliable baseline, then live WebSocket events
patch it on top for immediacy. Both paths are idempotent, so a reconnect cannot duplicate a case.

Actions call the service and refresh immediately, with a toast confirming the outcome:

| Control | Request |
|---|---|
| Primary action on a card | `POST /incidents/{alert_id}/advance` |
| Cancel this call | `POST /incidents/{alert_id}/cancel` |
| Report a crash | `POST /incidents` |
| Details | `GET /incidents/{alert_id}` (full event history) |

Skeletons stand in during load so the board never flashes empty. Filter tabs narrow the board to
all, critical, or arriving patients.

## Structure

```
src/
  App.tsx                 state, polling, stream handling, filters
  api.ts                  hospital service client
  theme.tsx               light/dark context with View Transitions
  index.css               OKLCH tokens, fluid type, component layer, interaction layer
  lib/status.ts           status -> plain language, severity words, tones
  lib/format.ts           relative times and ETAs
  lib/useStream.ts        websocket with reconnect backoff
  lib/useHoverFx.ts       pointer spotlight and tilt for a surface
  lib/viewTransition.ts   View Transition wrapper with a no-op fallback
  components/             TopBar, StatRow, IncidentCard, Stepper, MiniMap,
                          CapacityPanel, DetailSheet, Toaster, MagneticButton,
                          AuroraBackground, AnimatedNumber
```
