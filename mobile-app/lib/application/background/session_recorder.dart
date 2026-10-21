// Records DrivingSession rows from the DrivingDetector stream (task step 7):
// start time, end time, distance (speed integrated over time) and max speed.

import 'dart:async';

import '../../domain/domain.dart';
import '../../services/storage/sql_event_store.dart';

class SessionRecorder {
  SessionRecorder(this._driving, this._store) {
    _sub = _driving.snapshots.listen((s) => _on(s).catchError((Object e) {
          // Trip stats must never break driving mode.
        }));
  }

  final DrivingDetector _driving;
  final SessionStore _store;
  late final StreamSubscription<DrivingSnapshot> _sub;

  DrivingSession? _current;
  DateTime? _lastTick;
  DateTime _lastSave = DateTime.fromMillisecondsSinceEpoch(0);

  Future<void> _on(DrivingSnapshot s) async {
    final now = DateTime.now();
    if (s.status == DrivingStatus.driving) {
      final id = s.sessionId ?? 'session-${now.millisecondsSinceEpoch}';
      var cur = _current;
      if (cur == null || cur.id != id) {
        cur = DrivingSession(id: id, startTime: now);
        _lastTick = now;
        _current = cur;
        await _store.saveSession(cur);
        return;
      }
      final dtH = now.difference(_lastTick ?? now).inMilliseconds / 3.6e6;
      _lastTick = now;
      cur = DrivingSession(
        id: cur.id,
        startTime: cur.startTime,
        distanceKm: cur.distanceKm + s.speedKmh * dtH,
        maxSpeedKmh: s.speedKmh > cur.maxSpeedKmh ? s.speedKmh : cur.maxSpeedKmh,
      );
      _current = cur;
      if (now.difference(_lastSave).inSeconds >= 5) {
        _lastSave = now;
        await _store.saveSession(cur);
      }
    } else if (_current != null) {
      final c = _current!;
      _current = null;
      await _store.saveSession(DrivingSession(
        id: c.id,
        startTime: c.startTime,
        endTime: now,
        distanceKm: c.distanceKm,
        maxSpeedKmh: c.maxSpeedKmh,
      ));
    }
  }

  void dispose() => _sub.cancel();
}
