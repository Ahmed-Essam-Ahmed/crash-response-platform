// Map choice (task step 12): flutter_map + OpenStreetMap tiles.
// Why: no API key or billing account, works on Android, iOS and web, and is
// enough for "show a pin". google_maps_flutter needs a Cloud project + key per
// platform. Comparison paragraph for the report: docs/map-choice.md.

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../domain/domain.dart';
import '../theme.dart';

class EventMap extends StatelessWidget {
  const EventMap({super.key, required this.location, this.zoom = 15});

  final GeoLocation location;
  final double zoom;

  @override
  Widget build(BuildContext context) {
    final point = LatLng(location.latitude, location.longitude);
    return FlutterMap(
      options: MapOptions(initialCenter: point, initialZoom: zoom),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.safedrive.safedrive',
        ),
        MarkerLayer(
          markers: [
            Marker(
              point: point,
              width: 44,
              height: 44,
              alignment: Alignment.topCenter,
              child: const Icon(Icons.location_on, color: AppColors.danger, size: 44),
            ),
          ],
        ),
        const SimpleAttributionWidget(source: Text('OpenStreetMap contributors')),
      ],
    );
  }
}
