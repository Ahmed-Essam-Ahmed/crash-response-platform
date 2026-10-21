import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safedrive/application/detection/scenario_generator.dart';
import 'package:safedrive/domain/domain.dart';
import 'package:safedrive/services/notifications/alert_dispatcher.dart';
import 'package:safedrive/services/notifications/queued_dispatcher.dart';
import 'package:safedrive/services/storage/codec.dart';
import 'package:safedrive/services/storage/database.dart';
import 'package:safedrive/services/storage/settings_repository.dart';
import 'package:safedrive/services/storage/sql_event_store.dart';

import 'fakes.dart';

AccidentEvent _event(String id, {AccidentStatus status = AccidentStatus.dispatched}) => AccidentEvent(
      id: id,
      timestamp: DateTime(2026, 10, 15, 12, 0, int.parse(id)),
      sessionId: 's1',
      eventClass: EventClass.severeAccident,
      confidence: 82,
      severity: const Severity(level: SeverityLevel.high, score: 0.9),
      maxAccel: 8.1,
      maxGyro: 3,
      speedBefore: 82,
      speedAfter: 0,
      rollover: false,
      location: const GeoLocation(latitude: 30.0444, longitude: 31.2357),
      status: status,
      sensorWindowRef: 'w$id',
    );

SensorWindow _window(String id) {
  final t = DateTime(2026, 10, 15, 12);
  return SensorWindow(
    id: id,
    eventTime: t,
    samples: ScenarioGenerator.generate(Scenario.severeImpact, start: t).take(1000).toList(),
  );
}

/// SQLite may be missing on the test host (Windows). Then DB tests skip;
/// the same code is exercised on the device by the e2e test.
SafeDriveDb? _openDb() {
  try {
    return SafeDriveDb(NativeDatabase.memory());
  } catch (_) {
    return null;
  }
}

class _FakeRemote implements RemoteSink {
  final uploaded = <String>[];
  bool online = true;
  @override
  Future<void> uploadEvent(AccidentEvent e, SensorWindow? w) async {
    if (!online) throw StateError('offline');
    uploaded.add(e.id);
  }

  @override
  Future<void> uploadSession(DrivingSession s) async {}
}

void main() {
  group('codec (pure Dart)', () {
    test('event row round-trip', () {
      final e = _event('1');
      expect(Codec.eventFromRow(Codec.eventToRow(e)), e);
    });

    test('sensor window is compressed and restored', () {
      final w = _window('w1');
      final blob = Codec.compressWindow(w);
      expect(blob.length, lessThan(w.samples.length * 20)); // well under raw size
      final back = Codec.decompressWindow(w.id, w.eventTime, blob);
      expect(back.samples.length, w.samples.length);
      expect(back.samples[500].ax, closeTo(w.samples[500].ax, 0.001));
      expect(back.samples[500].speedKmh, w.samples[500].speedKmh);
    });

    test('settings + contacts JSON', () {
      const s = AppSettings(user: UserSettings(countdownSec: 30), onboardingDone: true);
      expect(Codec.settingsFromJson(Codec.settingsToJson(s)), s);
      const c = [EmergencyContact(id: '1', name: 'Mom', phone: '010', priority: 1)];
      expect(Codec.contactsFromJson(Codec.contactsToJson(c)), c);
      expect(Codec.contactsFromJson('garbage'), isEmpty);
    });
  });

  group('SQLite', () {
    late SafeDriveDb? db;
    setUp(() => db = _openDb());
    tearDown(() async => db?.close());

    Future<bool> ready() async {
      if (db == null) return false;
      try {
        await db!.query('SELECT 1');
        return true;
      } catch (_) {
        return false;
      }
    }

    test('events + windows persist; offline events sync later', () async {
      if (!await ready()) return markTestSkipped('sqlite3 not available on this host');
      final store = SqlEventStore(db!);
      await store.saveLocal(_event('1'), window: _window('w1'));
      await store.saveLocal(_event('2', status: AccidentStatus.cancelled));
      expect((await store.history()).map((e) => e.id), ['2', '1']);
      final (e, w) = (await store.eventDetail('1'))!;
      expect(e.confidence, 82);
      expect(w!.samples, hasLength(1000));

      expect(await store.syncPending(), 0); // no backend yet → stays pending
      expect(await store.pendingCount(), 2);
      final remote = _FakeRemote()..online = false;
      store.remote = remote;
      expect(await store.syncPending(), 0); // offline
      remote.online = true;
      expect(await store.syncPending(), 2); // network back → synced
      expect(await store.pendingCount(), 0);
      store.dispose();
    });

    test('alert queued while offline, sent when network returns', () async {
      if (!await ready()) return markTestSkipped('sqlite3 not available on this host');
      final inner = RecordingDispatcher(online: false);
      final q = QueuedAlertDispatcher(inner, db!);
      const contacts = [EmergencyContact(id: '1', name: 'Mom', phone: '010', priority: 1)];

      final r = await q.notifyContacts(contacts, 'SafeDrive Emergency Alert');
      expect(r.anyAutomaticSent, isFalse);
      expect(r.details.last, contains('queued'));
      expect(await q.pending(), 1);

      expect(await q.flush(), 0); // still offline
      inner.online = true;
      expect(await q.flush(), 1); // delivered
      expect(await q.pending(), 0);
      expect(inner.calls.last.$2, 'SafeDrive Emergency Alert');
    });

    test('one-tap dispatcher is never queued', () async {
      if (!await ready()) return markTestSkipped('sqlite3 not available on this host');
      final q = QueuedAlertDispatcher(LocalOnlyAlertDispatcher(), db!);
      await q.notifyContacts(
          const [EmergencyContact(id: '1', name: 'A', phone: '1', priority: 1)], 'x');
      expect(await q.pending(), 0);
    });
  });
}
