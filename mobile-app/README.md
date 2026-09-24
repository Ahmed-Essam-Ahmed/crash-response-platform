# Part 1 — Mobile Application

The phone-side client that mimics Apple's Crash Detection. It plays back sensor streams generated
by `simulation`, does a preliminary on-device check, and on detection builds the emergency payload
(geolocation, severity, medical profile) and submits it to the backend.

## Ownership

Team member 1.

## Responsibilities

- Playback of a simulated "drive" (reads a `simulation` scenario JSON).
- Live speed/g-force indicator during the drive.
- On-impact: emergency state with countdown + severity display.
- Submits `crash_detected` payload to backend `POST /alerts`.
- Shows simulated contact-notification confirmation.

## Run

```bash
npm install
npx react-native run-ios    # or: run-android
```

Place a generated scenario at `src/assets/scenario.json` (export from `simulation`), or load it
from a URL served by the backend.

## Layout

```
App.tsx                      # navigation + app shell
src/
  types.ts                   # shared payload types (mirror contracts)
  services/api.ts            # backend client (POST /alerts)
  screens/
    DriveScreen.tsx          # playback UI + live g-meter
    EmergencyScreen.tsx      # post-detection alert state
assets/                      # bundled scenarios
```

Contract payloads mirror [`contracts/README.md`](../contracts/README.md).