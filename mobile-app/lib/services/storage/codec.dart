// Serialization for local storage (and later Firestore): rows ⇄ entities,
// JSON for settings/contacts, and gzip-compressed sensor windows.

import 'dart:convert';
import 'dart:io' show gzip;

import '../../domain/domain.dart';
import 'settings_repository.dart';

class Codec {
  // ------------------------------------------------------------ events

  static Map<String, Object?> eventToRow(AccidentEvent e) => {
        'id': e.id,
        'ts': e.timestamp.millisecondsSinceEpoch,
        'session_id': e.sessionId,
        'class': e.eventClass.name,
        'confidence': e.confidence,
        'severity': e.severity?.level.name,
        'severity_score': e.severity?.score,
        'max_accel': e.maxAccel,
        'max_gyro': e.maxGyro,
        'speed_before': e.speedBefore,
        'speed_after': e.speedAfter,
        'rollover': e.rollover ? 1 : 0,
        'lat': e.location?.latitude,
        'lng': e.location?.longitude,
        'status': e.status.name,
        'window_ref': e.sensorWindowRef,
      };

  static double _d(Object? v) => (v as num?)?.toDouble() ?? 0;

  static AccidentEvent eventFromRow(Map<String, Object?> r) {
    final sev = r['severity'] as String?;
    final lat = r['lat'] as num?, lng = r['lng'] as num?;
    return AccidentEvent(
      id: r['id']! as String,
      timestamp: DateTime.fromMillisecondsSinceEpoch((r['ts']! as num).toInt()),
      sessionId: r['session_id'] as String? ?? 'no-session',
      eventClass: EventClass.values.byName(r['class']! as String),
      confidence: _d(r['confidence']),
      severity: sev == null
          ? null
          : Severity(level: SeverityLevel.values.byName(sev), score: _d(r['severity_score'])),
      maxAccel: _d(r['max_accel']),
      maxGyro: _d(r['max_gyro']),
      speedBefore: _d(r['speed_before']),
      speedAfter: _d(r['speed_after']),
      rollover: (r['rollover'] as num? ?? 0) == 1,
      location: lat == null || lng == null
          ? null
          : GeoLocation(latitude: lat.toDouble(), longitude: lng.toDouble()),
      status: AccidentStatus.values.byName(r['status']! as String),
      sensorWindowRef: r['window_ref'] as String?,
    );
  }

  // ------------------------------------------------------------ sensor windows
  // [msOffset, ax, ay, az, gx, gy, gz, speed|null] rounded → JSON → gzip.
  // ~1000 samples ≈ 30–40 KB raw → a few KB compressed.

  static double _r(double v) => (v * 1000).roundToDouble() / 1000;

  static List<int> compressWindow(SensorWindow w) {
    final t0 = w.eventTime.millisecondsSinceEpoch;
    final rows = [
      for (final s in w.samples)
        [
          s.timestamp.millisecondsSinceEpoch - t0,
          _r(s.ax), _r(s.ay), _r(s.az), _r(s.gx), _r(s.gy), _r(s.gz),
          s.speedKmh == null ? null : _r(s.speedKmh!),
        ],
    ];
    return gzip.encode(utf8.encode(jsonEncode(rows)));
  }

  static SensorWindow decompressWindow(String id, DateTime eventTime, List<int> blob) {
    final rows = jsonDecode(utf8.decode(gzip.decode(blob))) as List;
    final t0 = eventTime.millisecondsSinceEpoch;
    return SensorWindow(
      id: id,
      eventTime: eventTime,
      samples: [
        for (final r in rows.cast<List>())
          SensorSample(
            timestamp: DateTime.fromMillisecondsSinceEpoch(t0 + (r[0] as num).toInt()),
            ax: _d(r[1]),
            ay: _d(r[2]),
            az: _d(r[3]),
            gx: _d(r[4]),
            gy: _d(r[5]),
            gz: _d(r[6]),
            speedKmh: (r[7] as num?)?.toDouble(),
          ),
      ],
    );
  }

  // ------------------------------------------------------------ sessions

  static Map<String, Object?> sessionToRow(DrivingSession s) => {
        'id': s.id,
        'start': s.startTime.millisecondsSinceEpoch,
        'end': s.endTime?.millisecondsSinceEpoch,
        'distance_km': s.distanceKm,
        'max_speed': s.maxSpeedKmh,
      };

  static DrivingSession sessionFromRow(Map<String, Object?> r) => DrivingSession(
        id: r['id']! as String,
        startTime: DateTime.fromMillisecondsSinceEpoch((r['start']! as num).toInt()),
        endTime: r['end'] == null
            ? null
            : DateTime.fromMillisecondsSinceEpoch((r['end']! as num).toInt()),
        distanceKm: _d(r['distance_km']),
        maxSpeedKmh: _d(r['max_speed']),
      );

  // ------------------------------------------------------------ settings / contacts

  static String settingsToJson(AppSettings s) => jsonEncode({
        'countdownSec': s.user.countdownSec,
        'confidenceThreshold': s.user.confidenceThreshold,
        'detectionEnabled': s.detectionEnabled,
        'onboardingDone': s.onboardingDone,
      });

  static AppSettings settingsFromJson(String? json) {
    if (json == null) return const AppSettings();
    try {
      final m = jsonDecode(json) as Map<String, dynamic>;
      return AppSettings(
        user: UserSettings(
          countdownSec: (m['countdownSec'] as num?)?.toInt() ?? 20,
          confidenceThreshold: (m['confidenceThreshold'] as num?)?.toInt() ?? 70,
        ),
        detectionEnabled: m['detectionEnabled'] as bool? ?? true,
        onboardingDone: m['onboardingDone'] as bool? ?? false,
      );
    } catch (_) {
      return const AppSettings();
    }
  }

  static String contactsToJson(List<EmergencyContact> list) => jsonEncode([
        for (final c in list)
          {'id': c.id, 'name': c.name, 'phone': c.phone, 'priority': c.priority, 'fcmToken': c.fcmToken},
      ]);

  static List<EmergencyContact> contactsFromJson(String? json) {
    if (json == null) return const [];
    try {
      return [
        for (final m in (jsonDecode(json) as List).cast<Map<String, dynamic>>())
          EmergencyContact(
            id: m['id'] as String,
            name: m['name'] as String,
            phone: m['phone'] as String,
            priority: (m['priority'] as num).toInt(),
            fcmToken: m['fcmToken'] as String?,
          ),
      ]..sort((a, b) => a.priority.compareTo(b.priority));
    } catch (_) {
      return const [];
    }
  }
}
