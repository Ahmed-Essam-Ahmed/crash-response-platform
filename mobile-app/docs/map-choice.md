# Map choice — flutter_map (OpenStreetMap) vs google_maps_flutter

| | flutter_map + OSM tiles | google_maps_flutter |
|---|---|---|
| API key / billing | None | Google Cloud project, API key per platform, billing account |
| Platforms | Android, iOS, web, desktop (pure Dart) | Android, iOS, web (platform views) |
| What we need | Show one pin + allow zoom/pan | Same |
| Offline | Tile caching possible via plugins | Limited |
| Look | Standard OSM style | Familiar Google style |
| Usage policy | OSM tile servers: fair use, set a User-Agent, attribution required | Paid beyond free quota |

**Decision:** flutter_map with OpenStreetMap tiles — no key/billing setup, one
widget (`lib/presentation/widgets/event_map.dart`) works on every platform, and
the app only needs a pin on the accident location. The emergency SMS still
uses a Google Maps link (`maps.google.com/?q=lat,lng`) because every phone can
open it. Limitation: public OSM tiles are for light use; a production app
would use a tile provider with an SLA. To agree with Ahmed (file 05 step 12).
