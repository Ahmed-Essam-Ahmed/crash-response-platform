// Persistent EventRepository (task step 6): SQLite on the phone, survives
// restarts, works offline. syncPending() pushes unsynced rows to the backend
// through [RemoteSink] (Firestore once Firebase is enabled).

import 'dart:async';
import 'dart:typed_data';

import '../../domain/domain.dart';
import 'codec.dart';
import 'database.dart';
import 'event_repository_memory.dart';

/// Backend upload target. Firestore implementation arrives with Firebase.
abstract interface class RemoteSink {
  Future<void> uploadEvent(AccidentEvent event, SensorWindow? window);
  Future<void> uploadSession(DrivingSession session);
}

/// Sessions are persisted next to events.
abstract interface class SessionStore {
  Future<void> saveSession(DrivingSession s);
  Future<List<DrivingSession>> sessions();
  Stream<List<DrivingSession>> watchSessions();
}

class SqlEventStore implements LocalEventStore, SessionStore {
  SqlEventStore(this._db, {this.remote});

  final SafeDriveDb _db;

  /// null until the backend exists → events stay "pending" (not lost).
  RemoteSink? remote;

  final _events = StreamController<List<AccidentEvent>>.broadcast();
  final _sessions = StreamController<List<DrivingSession>>.broadcast();

  Future<void> _publish() async => _events.add(await history());
  Future<void> _publishSessions() async => _sessions.add(await sessions());

  @override
  Stream<List<AccidentEvent>> watch() async* {
    yield await history();
    yield* _events.stream;
  }

  @override
  Future<void> saveLocal(AccidentEvent event, {SensorWindow? window}) async {
    final row = Codec.eventToRow(event);
    final cols = row.keys.map((k) => '"$k"').join(', ');
    final qs = List.filled(row.length, '?').join(', ');
    await _db.exec(
      'INSERT OR REPLACE INTO events ($cols, synced) VALUES ($qs, 0)',
      row.values.toList(),
    );
    if (window != null) {
      await _db.exec(
        'INSERT OR REPLACE INTO sensor_windows (id, event_time, data) VALUES (?, ?, ?)',
        [window.id, window.eventTime.millisecondsSinceEpoch, Codec.compressWindow(window)],
      );
    }
    await _publish();
  }

  @override
  Future<List<AccidentEvent>> history() async {
    final rows = await _db.query('SELECT * FROM events ORDER BY ts DESC');
    return [for (final r in rows) Codec.eventFromRow(r)];
  }

  @override
  Future<(AccidentEvent, SensorWindow?)?> eventDetail(String id) async {
    final rows = await _db.query('SELECT * FROM events WHERE id = ?', [id]);
    if (rows.isEmpty) return null;
    final e = Codec.eventFromRow(rows.first);
    return (e, await _window(e.sensorWindowRef));
  }

  Future<SensorWindow?> _window(String? ref) async {
    if (ref == null) return null;
    final w = await _db.query('SELECT * FROM sensor_windows WHERE id = ?', [ref]);
    if (w.isEmpty) return null;
    final data = w.first['data'];
    final bytes = data is Uint8List ? data : Uint8List.fromList((data! as List).cast<int>());
    return Codec.decompressWindow(
      ref,
      DateTime.fromMillisecondsSinceEpoch((w.first['event_time']! as num).toInt()),
      bytes,
    );
  }

  Future<int> pendingCount() async {
    final r = await _db.query('SELECT COUNT(*) AS n FROM events WHERE synced = 0');
    return (r.first['n']! as num).toInt();
  }

  @override
  Future<int> syncPending() async {
    final sink = remote;
    if (sink == null) return 0;
    var n = 0;
    for (final r in await _db.query('SELECT * FROM events WHERE synced = 0')) {
      final e = Codec.eventFromRow(r);
      try {
        await sink.uploadEvent(e, await _window(e.sensorWindowRef));
        await _db.exec('UPDATE events SET synced = 1 WHERE id = ?', [e.id]);
        n++;
      } catch (_) {
        break; // offline again — try next time
      }
    }
    for (final r in await _db.query('SELECT * FROM sessions WHERE synced = 0 AND "end" IS NOT NULL')) {
      try {
        await sink.uploadSession(Codec.sessionFromRow(r));
        await _db.exec('UPDATE sessions SET synced = 1 WHERE id = ?', [r['id']]);
      } catch (_) {
        break;
      }
    }
    return n;
  }

  @override
  Future<void> deleteAll() async {
    await _db.exec('DELETE FROM events');
    await _db.exec('DELETE FROM sensor_windows');
    await _db.exec('DELETE FROM sessions');
    await _db.exec('DELETE FROM outbox');
    await _publish();
    await _publishSessions();
  }

  // ------------------------------------------------------------ sessions

  @override
  Future<void> saveSession(DrivingSession s) async {
    final row = Codec.sessionToRow(s);
    await _db.exec(
      'INSERT OR REPLACE INTO sessions (id, start, "end", distance_km, max_speed, synced) '
      'VALUES (?, ?, ?, ?, ?, 0)',
      [row['id'], row['start'], row['end'], row['distance_km'], row['max_speed']],
    );
    await _publishSessions();
  }

  @override
  Future<List<DrivingSession>> sessions() async {
    final rows = await _db.query('SELECT * FROM sessions ORDER BY start DESC');
    return [for (final r in rows) Codec.sessionFromRow(r)];
  }

  @override
  Stream<List<DrivingSession>> watchSessions() async* {
    yield await sessions();
    yield* _sessions.stream;
  }

  void dispose() {
    _events.close();
    _sessions.close();
  }
}
