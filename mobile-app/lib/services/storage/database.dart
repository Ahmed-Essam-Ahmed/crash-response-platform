// Local SQLite database (drift, locked stack) — task step 6.
//
// Plain SQL through drift's GeneratedDatabase, so no code generation step is
// needed. Tables mirror the Firestore schema (file 02 §7) plus `synced` flags
// and an `outbox` for alerts that could not be delivered while offline.

import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

const _schema = [
  '''CREATE TABLE IF NOT EXISTS events (
       id TEXT PRIMARY KEY,
       ts INTEGER NOT NULL,
       session_id TEXT,
       class TEXT NOT NULL,
       confidence REAL NOT NULL,
       severity TEXT,
       severity_score REAL,
       max_accel REAL, max_gyro REAL,
       speed_before REAL, speed_after REAL,
       rollover INTEGER NOT NULL DEFAULT 0,
       lat REAL, lng REAL,
       status TEXT NOT NULL,
       window_ref TEXT,
       synced INTEGER NOT NULL DEFAULT 0)''',
  '''CREATE TABLE IF NOT EXISTS sensor_windows (
       id TEXT PRIMARY KEY,
       event_time INTEGER NOT NULL,
       data BLOB NOT NULL)''',
  '''CREATE TABLE IF NOT EXISTS sessions (
       id TEXT PRIMARY KEY,
       start INTEGER NOT NULL,
       "end" INTEGER,
       distance_km REAL NOT NULL DEFAULT 0,
       max_speed REAL NOT NULL DEFAULT 0,
       synced INTEGER NOT NULL DEFAULT 0)''',
  '''CREATE TABLE IF NOT EXISTS outbox (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       kind TEXT NOT NULL,
       payload TEXT NOT NULL,
       created INTEGER NOT NULL,
       attempts INTEGER NOT NULL DEFAULT 0,
       last_error TEXT)''',
  '''CREATE TABLE IF NOT EXISTS kv (
       key TEXT PRIMARY KEY,
       value TEXT)''',
  'CREATE INDEX IF NOT EXISTS events_ts ON events(ts DESC)',
];

class SafeDriveDb extends GeneratedDatabase {
  SafeDriveDb(super.executor);

  /// On-device file `safedrive.sqlite` in the app's documents folder.
  factory SafeDriveDb.open() => SafeDriveDb(driftDatabase(name: 'safedrive'));

  @override
  Iterable<TableInfo<Table, Object?>> get allTables => const [];

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) async {
          for (final s in _schema) {
            await customStatement(s);
          }
        },
        beforeOpen: (details) async {
          // Idempotent: also repairs a DB created by an older build.
          for (final s in _schema) {
            await customStatement(s);
          }
        },
      );

  Future<List<Map<String, Object?>>> query(String sql, [List<Object?> args = const []]) async {
    final rows = await customSelect(sql, variables: [for (final a in args) _var(a)]).get();
    return [for (final r in rows) r.data];
  }

  Future<void> exec(String sql, [List<Object?> args = const []]) =>
      customStatement(sql, args);

  static Variable _var(Object? v) => switch (v) {
        null => const Variable(null),
        final int i => Variable<int>(i),
        final double d => Variable<double>(d),
        final bool b => Variable<int>(b ? 1 : 0),
        final String s => Variable<String>(s),
        final Uint8List u => Variable<Uint8List>(u),
        final List<int> l => Variable<Uint8List>(Uint8List.fromList(l)),
        _ => Variable<String>(v.toString()),
      };
}
