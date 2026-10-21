# `lib/domain/` — draft for Week 1 review (Hazem → Ahmed)

Everything in `lib/domain/` follows file 02 §6 and §7. Where file 02 does not
say something, I made a choice below. **Please confirm or change each one**, then
we commit `lib/domain/` together and freeze it.

| # | Item | What I chose | Why |
|---|------|--------------|-----|
| 1 | `FeatureVector` units | accel in **g**, jerk in g/s, gyro energy in (rad/s)², orientationDelta in **degrees**, speeds in **km/h**, times in **s**, postEventMovement in **m** | Thresholds in file 02 §4 are written in g and km/h |
| 2 | `stdAccelPerAxis` type | `Axis3(x, y, z)` | Needs 3 values; a small class is clearer than a list |
| 3 | `SensorSample` units | raw accel in **m/s²** (incl. gravity), gyro in **rad/s** | What `sensors_plus` gives directly |
| 4 | `Severity.score` range | 0–1 (to confirm with ML teammate) | Not specified |
| 5 | `DetectionEngine` | `Stream<AccidentEventResult> get events` | File 02 §6.2 says "emitted on a Dart stream" |
| 6 | `DrivingDetector` | `current`, `snapshots` stream of `DrivingSnapshot {status, sensors, speedKmh, autoDetected, sessionId}`, `startManual()`, `stopManual()` | Dashboard + Driving Mode + session persistence need it; not spelled out in file 02 |
| 7 | `SensorAvailability` | `{accelerometer, gyroscope, gps, barometer}` + `canMonitor` | File 02 §3 fallbacks — UI must show degraded states |
| 8 | `EventRepository.saveLocal` | `saveLocal(AccidentEvent, {SensorWindow? window})` | The window has to be stored with the event for the graphs |
| 9 | `EventRepository.syncPending` | returns `Future<int>` (count synced) | Useful for UI/tests |
| 10 | `EventRepository.eventDetail` | returns `(AccidentEvent, SensorWindow?)?` | Detail screen needs the window |
| 11 | `SeverityModelClient` failure | **throws** when unreachable → caller uses Crash Confidence fallback | Locked decision 4 |
| 12 | Default `confidenceThreshold` | 70 (experimental) | Not specified |
| 13 | `GeoLocation` | lat, lng, speedKmh?, headingDeg?, altitudeM?, timestamp? + `mapsUrl` | Brief "LOCATION" section |

After we agree: add these to file 02 "Locked decisions" the same day.
