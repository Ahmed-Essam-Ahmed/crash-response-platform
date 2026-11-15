# Part 1 — Mobile Application

The phone-side client that mimics Apple's Crash Detection. It is the **sensor source**: it reads the
device accelerometer, gyroscope, and GPS (with a recorded-trip replay fallback for emulators/demos),
keeps a sliding window, calls the AI service, and on detection builds the emergency payload
(geolocation, severity, medical profile, emergency contacts) and submits it to the backend.

## Ownership

Team member 1.

## Responsibilities

- Reads live device sensors (accelerometer/gyro/GPS); replays a recorded trip for emulator/demo.
- Builds a sliding `sensor_sample` window and calls the AI service (`POST /detect`).
- Live speed/g-force indicator during the drive.
- On-impact: emergency state with countdown + severity display.
- Submits the resulting `crash_detected` payload to backend `POST /cases` (`X-Ingest-Key`).
- Shows simulated contact-notification confirmation.

## Run

```bash
npm install
npx react-native run-ios    # or: run-android
```

On a device the app reads live sensors. For the emulator/demo it replays a recorded trip from
`assets/scenario.json`.

## Layout

```
App.tsx                      # navigation + app shell
src/
  types.ts                   # shared payload types (mirror contracts)
  services/api.ts            # AI client (POST /detect) + backend client (POST /cases)
  screens/
    DriveScreen.tsx          # sensor/replay UI + live g-meter
    EmergencyScreen.tsx      # post-detection alert state
assets/                      # recorded trip used for replay
```

Contract payloads mirror [`contracts/README.md`](../contracts/README.md).