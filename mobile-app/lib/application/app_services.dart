// Composition root: the ONE place that decides which implementation backs each
// interface. When Ahmed's engine / the ML model / Firebase land, only this
// file changes.

import 'package:flutter/foundation.dart';

import '../domain/domain.dart';
import '../services/location/location_provider.dart';
import '../services/mocks/mock_driving_detector.dart';
import '../services/mocks/mock_severity_client.dart';
import '../services/notifications/alert_dispatcher.dart';
import '../services/notifications/queued_dispatcher.dart';
import '../services/notifications/telegram_dispatcher.dart';
import '../services/notifications/twilio_dispatcher.dart';
import '../services/permissions/permission_service.dart';
import '../services/storage/contacts_repository.dart';
import '../services/storage/database.dart';
import '../services/storage/event_repository_memory.dart';
import '../services/storage/persistent_repositories.dart';
import '../services/storage/settings_repository.dart';
import '../services/storage/sql_event_store.dart';
import 'background/session_recorder.dart';
import 'detection/sensor_fusion_engine.dart';
import 'test_mode/scenario_runner.dart';

class AppServices {
  AppServices({
    required this.drivingDetector,
    required this.detectionEngine,
    required this.scenarios,
    required this.monitor,
    required this.severityModel,
    required this.events,
    required this.contacts,
    required this.settings,
    required this.location,
    required this.dispatcher,
    required this.permissions,
    this.sessions,
    this.onInit,
    this.onDispose,
  });

  /// The real app: SQLite storage, encrypted contacts, offline alert queue +
  /// background sync, live sensor engine. Falls back to [mock] on web.
  factory AppServices.production() {
    if (kIsWeb) return AppServices.mock();
    final db = SafeDriveDb.open();
    final detector = MockDrivingDetector(); // → Ahmed's DrivingDetector
    final loc = GeolocatorLocationProvider();
    final engine = SensorFusionEngine(
      driving: detector,
      onReplaySpeed: detector.overrideSpeed,
      locate: loc.current,
    );
    final store = SqlEventStore(db); // remote: FirestoreSink once Firebase is on
    final settings = SqlSettingsRepository(db);
    final contacts = SecureContactsRepository(PlatformSecretStore());
    final queued = QueuedAlertDispatcher(_pickDispatcher(), db);
    final sync = SyncService(retry: [queued.flush, store.syncPending]);
    SessionRecorder? recorder;

    return AppServices(
      drivingDetector: detector,
      detectionEngine: engine,
      scenarios: engine,
      monitor: engine,
      severityModel: MockSeverityModelClient(), // → teammate's model
      events: store,
      sessions: store,
      contacts: contacts,
      settings: settings,
      location: loc,
      dispatcher: queued,
      permissions: PlatformPermissionService(),
      onInit: () async {
        await settings.load();
        await contacts.load();
        recorder = SessionRecorder(detector, store);
        sync.start();
      },
      onDispose: () {
        sync.dispose();
        recorder?.dispose();
        detector.dispose();
        engine.dispose();
        store.dispose();
        settings.dispose();
        contacts.dispose();
        db.close();
      },
    );
  }

  /// Everything in memory — tests, web preview.
  factory AppServices.mock({
    LocationProvider? location,
    AlertDispatcher? dispatcher,
    PermissionService? permissions,
  }) {
    final detector = MockDrivingDetector();
    final loc = location ?? GeolocatorLocationProvider();
    final engine = SensorFusionEngine(
      driving: detector,
      onReplaySpeed: detector.overrideSpeed,
      locate: loc.current,
    );
    final events = InMemoryEventRepository();
    final contacts = InMemoryContactsRepository();
    final settings = InMemorySettingsRepository();
    return AppServices(
      drivingDetector: detector,
      detectionEngine: engine,
      scenarios: engine,
      monitor: engine,
      severityModel: MockSeverityModelClient(),
      events: events,
      contacts: contacts,
      settings: settings,
      location: loc,
      dispatcher: dispatcher ?? _pickDispatcher(),
      permissions: permissions ?? (kIsWeb ? AllowAllPermissionService() : PlatformPermissionService()),
      onDispose: () {
        detector.dispose();
        engine.dispose();
        events.dispose();
        contacts.dispose();
        settings.dispose();
      },
    );
  }

  /// Automatic alert channel, from secrets.json (see README):
  /// Telegram bot (free) → Twilio SMS + call (paid) → one-tap SMS composer.
  static AlertDispatcher _pickDispatcher() {
    final telegram = TelegramConfig.fromEnvironment;
    if (telegram.isConfigured) return TelegramAlertDispatcher(telegram);
    const twilio = TwilioConfig.fromEnvironment;
    if (twilio.isConfigured) return TwilioAlertDispatcher(twilio);
    return LocalOnlyAlertDispatcher();
  }

  final DrivingDetector drivingDetector;
  final DetectionEngine detectionEngine;
  final ScenarioRunner scenarios;
  final DetectionMonitor monitor;
  final SeverityModelClient severityModel;
  final LocalEventStore events;
  final SessionStore? sessions;
  final ContactsRepository contacts;
  final SettingsRepository settings;
  final LocationProvider location;
  final AlertDispatcher dispatcher;
  final PermissionService permissions;
  final Future<void> Function()? onInit;
  final void Function()? onDispose;

  /// Splash-time initialisation: open DB, load settings + contacts, start the
  /// session recorder and background sync. Later: Firebase.initializeApp.
  Future<void> init() async {
    final started = DateTime.now();
    await onInit?.call();
    // Keep the splash visible briefly so it does not flash.
    final left = const Duration(milliseconds: 1200) - DateTime.now().difference(started);
    if (left > Duration.zero) await Future<void>.delayed(left);
  }

  void dispose() => onDispose?.call();
}
