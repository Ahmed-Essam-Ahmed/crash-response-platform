// SafeDrive — shared domain entities.
//
// CONTRACT FILE (file 02 §6 + §7). Fields mirror the Firestore schema exactly.
// Do NOT change anything here without agreeing it with Ahmed (Member A) first
// and updating file 02 the same day.

import 'package:equatable/equatable.dart';

import '../detection/event_class.dart';
import '../severity/severity.dart';

/// A point on the map plus the GPS context around it.
/// Firestore stores only lat/lng as a geopoint; the rest is local context.
class GeoLocation extends Equatable {
  const GeoLocation({
    required this.latitude,
    required this.longitude,
    this.speedKmh,
    this.headingDeg,
    this.altitudeM,
    this.timestamp,
  });

  final double latitude;
  final double longitude;
  final double? speedKmh;
  final double? headingDeg;
  final double? altitudeM;
  final DateTime? timestamp;

  /// Google Maps link used in the emergency message (file 02 §9).
  String get mapsUrl =>
      'https://maps.google.com/?q=${latitude.toStringAsFixed(6)},${longitude.toStringAsFixed(6)}';

  @override
  List<Object?> get props =>
      [latitude, longitude, speedKmh, headingDeg, altitudeM, timestamp];
}

/// users/{uid}.settings
class UserSettings extends Equatable {
  const UserSettings({
    this.countdownSec = 20,
    this.confidenceThreshold = 70,
  });

  /// Emergency countdown length in seconds (FR-09, default 20).
  final int countdownSec;

  /// Crash Confidence (0–100) above which an event counts as severe
  /// when the severity model is unreachable. Experimental value.
  final int confidenceThreshold;

  UserSettings copyWith({int? countdownSec, int? confidenceThreshold}) =>
      UserSettings(
        countdownSec: countdownSec ?? this.countdownSec,
        confidenceThreshold: confidenceThreshold ?? this.confidenceThreshold,
      );

  @override
  List<Object?> get props => [countdownSec, confidenceThreshold];
}

/// users/{uid}
class User extends Equatable {
  const User({
    required this.id,
    required this.name,
    required this.phone,
    this.settings = const UserSettings(),
  });

  final String id;
  final String name;
  final String phone;
  final UserSettings settings;

  @override
  List<Object?> get props => [id, name, phone, settings];
}

/// users/{uid}/emergencyContacts/{id}
class EmergencyContact extends Equatable {
  const EmergencyContact({
    required this.id,
    required this.name,
    required this.phone,
    required this.priority,
    this.fcmToken,
  });

  /// Maximum number of contacts per user (FR-02).
  static const int maxContacts = 5;

  final String id;
  final String name;
  final String phone;

  /// 1 = called/notified first.
  final int priority;

  /// Set only when the contact also has SafeDrive installed (FCM push).
  final String? fcmToken;

  EmergencyContact copyWith({
    String? name,
    String? phone,
    int? priority,
    String? fcmToken,
  }) =>
      EmergencyContact(
        id: id,
        name: name ?? this.name,
        phone: phone ?? this.phone,
        priority: priority ?? this.priority,
        fcmToken: fcmToken ?? this.fcmToken,
      );

  @override
  List<Object?> get props => [id, name, phone, priority, fcmToken];
}

/// users/{uid}/sessions/{id}
class DrivingSession extends Equatable {
  const DrivingSession({
    required this.id,
    required this.startTime,
    this.endTime,
    this.distanceKm = 0,
    this.maxSpeedKmh = 0,
  });

  final String id;
  final DateTime startTime;
  final DateTime? endTime;
  final double distanceKm;
  final double maxSpeedKmh;

  bool get isActive => endTime == null;

  @override
  List<Object?> get props => [id, startTime, endTime, distanceKm, maxSpeedKmh];
}

/// What happened after the emergency countdown.
enum AccidentStatus { cancelled, dispatched }

/// users/{uid}/accidents/{id}
class AccidentEvent extends Equatable {
  const AccidentEvent({
    required this.id,
    required this.timestamp,
    required this.sessionId,
    required this.eventClass,
    required this.confidence,
    required this.maxAccel,
    required this.maxGyro,
    required this.speedBefore,
    required this.speedAfter,
    required this.rollover,
    required this.status,
    this.severity,
    this.location,
    this.sensorWindowRef,
  });

  final String id;
  final DateTime timestamp;
  final String sessionId;
  final EventClass eventClass;

  /// Crash Confidence 0–100.
  final double confidence;

  /// From the external model; null if it was unreachable (fallback used).
  final Severity? severity;

  /// Peak acceleration magnitude, g.
  final double maxAccel;

  /// Peak angular velocity magnitude, rad/s.
  final double maxGyro;

  /// km/h.
  final double speedBefore;
  final double speedAfter;
  final bool rollover;
  final GeoLocation? location;
  final AccidentStatus status;

  /// Id of the stored [SensorWindow] (sensorWindows/{id}).
  final String? sensorWindowRef;

  @override
  List<Object?> get props => [
        id,
        timestamp,
        sessionId,
        eventClass,
        confidence,
        severity,
        maxAccel,
        maxGyro,
        speedBefore,
        speedAfter,
        rollover,
        location,
        status,
        sensorWindowRef,
      ];
}

/// One raw row of the ring buffer — same columns as the dataset format
/// (file 02 §5): timestamp, ax, ay, az, gx, gy, gz, speed, lat, lng, orientation.
class SensorSample extends Equatable {
  const SensorSample({
    required this.timestamp,
    required this.ax,
    required this.ay,
    required this.az,
    required this.gx,
    required this.gy,
    required this.gz,
    this.speedKmh,
    this.latitude,
    this.longitude,
    this.orientation,
  });

  final DateTime timestamp;

  /// m/s² (raw accelerometer incl. gravity).
  final double ax, ay, az;

  /// rad/s.
  final double gx, gy, gz;
  final double? speedKmh;
  final double? latitude;
  final double? longitude;
  final double? orientation;

  @override
  List<Object?> get props =>
      [timestamp, ax, ay, az, gx, gy, gz, speedKmh, latitude, longitude, orientation];
}

/// sensorWindows/{id} — the frozen ±10 s around an event, used by Stage 2
/// and by the accident-detail graphs.
class SensorWindow extends Equatable {
  const SensorWindow({
    required this.id,
    required this.eventTime,
    required this.samples,
  });

  final String id;
  final DateTime eventTime;
  final List<SensorSample> samples;

  @override
  List<Object?> get props => [id, eventTime, samples];
}
