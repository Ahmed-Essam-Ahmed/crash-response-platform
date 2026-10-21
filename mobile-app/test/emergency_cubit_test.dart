import 'package:flutter_test/flutter_test.dart';
import 'package:safedrive/application/emergency/emergency_cubit.dart';
import 'package:safedrive/domain/domain.dart';
import 'package:safedrive/services/mocks/mock_detection_engine.dart';
import 'package:safedrive/services/mocks/mock_driving_detector.dart';
import 'package:safedrive/services/mocks/mock_severity_client.dart';
import 'package:safedrive/services/storage/contacts_repository.dart';
import 'package:safedrive/services/storage/event_repository_memory.dart';
import 'package:safedrive/services/storage/settings_repository.dart';

import 'fakes.dart';

void main() {
  late MockDetectionEngine engine;
  late InMemoryEventRepository events;
  late InMemoryContactsRepository contacts;
  late RecordingDispatcher dispatcher;
  late EmergencyCubit cubit;

  const crashSite = GeoLocation(latitude: 30.05, longitude: 31.24, speedKmh: 0);

  EmergencyCubit build({SeverityModelClient? severity}) => EmergencyCubit(
        engine: engine,
        severityModel: severity ?? MockSeverityModelClient(),
        events: events,
        contacts: contacts,
        settings: InMemorySettingsRepository(),
        location: FakeLocationProvider(crashSite),
        dispatcher: dispatcher,
        driving: MockDrivingDetector(),
        severityTimeout: const Duration(seconds: 1),
      );

  Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 600));

  setUp(() {
    engine = MockDetectionEngine();
    events = InMemoryEventRepository();
    contacts = InMemoryContactsRepository(const [
      EmergencyContact(id: '1', name: 'Mom', phone: '01012345678', priority: 1),
    ]);
    dispatcher = RecordingDispatcher();
    cubit = build();
  });

  tearDown(() async {
    await cubit.close();
    engine.dispose();
  });

  test('severe impact starts the countdown with the configured length', () async {
    engine.emit(EventClass.severeAccident);
    await settle();
    final s = cubit.state;
    expect(s, isA<EmergencyCountdown>());
    expect((s as EmergencyCountdown).total, 20);
    expect(s.severity.isHigh, isTrue);
  });

  test("I'M OK cancels and saves the event as cancelled", () async {
    engine.emit(EventClass.severeAccident);
    await settle();
    await cubit.cancel();
    expect(cubit.state, isA<EmergencyCancelled>());
    final h = await events.history();
    expect(h.single.status, AccidentStatus.cancelled);
    expect(dispatcher.calls, isEmpty);
  });

  test('dispatch saves, notifies contacts with a map link, goes Active', () async {
    engine.emit(EventClass.possibleRollover);
    await settle();
    await cubit.dispatch();
    expect(cubit.state, isA<EmergencyActive>());
    final h = await events.history();
    expect(h.single.status, AccidentStatus.dispatched);
    expect(h.single.rollover, isTrue);
    expect(h.single.location, crashSite);
    final (to, msg) = dispatcher.calls.single;
    expect(to.single.name, 'Mom');
    expect(msg, contains('SafeDrive Emergency Alert'));
    expect(msg, contains('https://maps.google.com/?q=30.050000,31.240000'));
  });

  test('minor events are logged without any alert', () async {
    engine.emit(EventClass.pothole);
    await settle();
    expect(cubit.state, isA<EmergencyIdle>());
    expect((await events.history()).single.eventClass, EventClass.pothole);
  });

  test('model unreachable → rule-based confidence fallback still alerts', () async {
    await cubit.close();
    cubit = build(severity: UnreachableSeverity());
    engine.emit(EventClass.severeAccident); // confidence 94 ≥ threshold 70
    await settle();
    final s = cubit.state;
    expect(s, isA<EmergencyCountdown>());
    expect((s as EmergencyCountdown).severityFromModel, isFalse);
  });
}
