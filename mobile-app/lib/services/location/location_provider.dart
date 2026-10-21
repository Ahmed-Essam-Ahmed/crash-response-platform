// Latest-location lookup used at dispatch time (FR-11).

import 'package:geolocator/geolocator.dart';

import '../../domain/domain.dart';

abstract interface class LocationProvider {
  /// Best location available right now, or null.
  Future<GeoLocation?> current();

  /// Ask for location permission (called once after onboarding).
  Future<bool> ensurePermission();
}

class GeolocatorLocationProvider implements LocationProvider {
  @override
  Future<bool> ensurePermission() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return false;
      var p = await Geolocator.checkPermission();
      if (p == LocationPermission.denied) {
        p = await Geolocator.requestPermission();
      }
      return p == LocationPermission.always || p == LocationPermission.whileInUse;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<GeoLocation?> current() async {
    try {
      final p = await Geolocator.checkPermission();
      if (p == LocationPermission.denied || p == LocationPermission.deniedForever) {
        return null;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 6),
        ),
      );
      return _toGeo(pos);
    } catch (_) {
      // Timeout / no fix → last known (not available on web).
      try {
        final last = await Geolocator.getLastKnownPosition();
        return last == null ? null : _toGeo(last);
      } catch (_) {
        return null;
      }
    }
  }

  static GeoLocation _toGeo(Position p) => GeoLocation(
        latitude: p.latitude,
        longitude: p.longitude,
        speedKmh: p.speed >= 0 ? p.speed * 3.6 : null,
        headingDeg: p.heading,
        altitudeM: p.altitude,
        timestamp: p.timestamp,
      );
}
