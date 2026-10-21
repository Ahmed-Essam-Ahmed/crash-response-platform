// EmergencyController implementation (task steps 7–8).
//
// Event stream → persist → severity (external model, rule-based fallback)
//   → HIGH: countdown (configurable, default 20 s)
//        → I'M OK: saved as cancelled
//        → timeout: latest location → persist → notify contacts → Active

import 'dart:async';
import 'dart:math' as math;

import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/domain.dart';
import '../../services/location/location_provider.dart';
import '../../services/notifications/alert_dispatcher.dart';
import '../../services/storage/contacts_repository.dart';
import '../../services/storage/settings_repository.dart';

sealed class EmergencyState extends Equatable {
  const EmergencyState();
  @override
  List<Object?> get props => [];
}

class EmergencyIdle extends EmergencyState {
  const EmergencyIdle({this.lastEvent});

  /// Most recent detection (any class) — Test Mode shows it.
  final AccidentEvent? lastEvent;

  @override
  List<Object?> get props => [lastEvent];
}

class EmergencyCountdown extends EmergencyState {
  const EmergencyCountdown({
    required this.result,
    required this.severity,
    required this.remaining,
    required this.total,
    required this.severityFromModel,
  });

  final AccidentEventResult result;
  final Severity severity;
  final int remaining;
  final int total;

  /// false = model unreachable, rule-based Crash Confidence used.
  final bool severityFromModel;

  @override
  List<Object?> get props => [result, severity, remaining, total, severityFromModel];
}

class EmergencyDispatching extends EmergencyState {
  const EmergencyDispatching();
}

class EmergencyActive extends EmergencyState {
  const EmergencyActive({
    required this.event,
    required this.message,
    required this.contacts,
    required this.report,
  });

  final AccidentEvent event;
  final String message;
  final List<EmergencyContact> contacts;
  final DispatchReport report;

  @override
  List<Object?> get props => [event, message, contacts];
}

class EmergencyCancelled extends EmergencyState {
  const EmergencyCancelled(this.event);
  final AccidentEvent event;
  @override
  List<Object?> get props => [event];
}

class EmergencyCubit extends Cubit<EmergencyState> implements EmergencyController {
  EmergencyCubit({
    required DetectionEngine engine,
    required SeverityModelClient severityModel,
    required EventRepository events,
    required ContactsRepository contacts,
    required SettingsRepository settings,
    required LocationProvider location,
    required AlertDispatcher dispatcher,
    required DrivingDetector driving,
    this.severityTimeout = const Duration(seconds: 3),
  })  : _severityModel = severityModel,
        _events = events,
        _contacts = contacts,
        _settings = settings,
        _location = location,
        _dispatcher = dispatcher,
        _driving = driving,
        super(const EmergencyIdle()) {
    _sub = engine.events.listen(_onDetection);
  }

  final SeverityModelClient _severityModel;
  final EventRepository _events;
  final ContactsRepository _contacts;
  final SettingsRepository _settings;
  final LocationProvider _location;
  final AlertDispatcher _dispatcher;
  final DrivingDetector _driving;
  final Duration severityTimeout;

  late final StreamSubscription<AccidentEventResult> _sub;
  Timer? _timer;
  AccidentEventResult? _active;
  Severity? _activeSeverity;
  int _seq = 0;

  bool get _busy => state is EmergencyCountdown || state is EmergencyDispatching;

  Future<void> _onDetection(AccidentEventResult r) async {
    try {
      await _handleDetection(r);
    } catch (err, st) {
      debugPrint('SafeDrive: detection handling failed: $err\n$st');
    }
  }

  Future<void> _handleDetection(AccidentEventResult r) async {
    if (!_settings.current.detectionEnabled) return;
    if (r.eventClass == EventClass.normalDriving) {
      emit(EmergencyIdle(lastEvent: _toEvent(r, null, AccidentStatus.cancelled)));
      return;
    }
    if (_busy) return; // one emergency at a time

    // Minor classes: log and continue driving.
    if (!r.eventClass.isAccident) {
      final e = _toEvent(r, null, AccidentStatus.cancelled);
      await _persist(e, r.sensorWindow);
      emit(EmergencyIdle(lastEvent: e));
      return;
    }

    // Accident classes: ask the external model, fall back to confidence.
    Severity severity;
    var fromModel = true;
    try {
      severity = await _severityModel.getSeverity(r.features).timeout(severityTimeout);
    } catch (_) {
      fromModel = false;
      final threshold = _settings.current.user.confidenceThreshold;
      severity = Severity(
        level: r.confidence >= threshold ? SeverityLevel.high : SeverityLevel.medium,
        score: r.confidence / 100,
      );
    }

    if (severity.isHigh) {
      await raiseSevereEvent(r, severity, fromModel: fromModel);
    } else {
      final e = _toEvent(r, severity, AccidentStatus.cancelled);
      await _persist(e, r.sensorWindow);
      emit(EmergencyIdle(lastEvent: e));
    }
  }

  @override
  Future<void> raiseSevereEvent(
    AccidentEventResult event,
    Severity severity, {
    bool fromModel = true,
  }) async {
    if (_busy) return;
    _active = event;
    _activeSeverity = severity;
    final total = _settings.current.user.countdownSec;
    emit(EmergencyCountdown(
      result: event,
      severity: severity,
      remaining: total,
      total: total,
      severityFromModel: fromModel,
    ));
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      final s = state;
      if (s is! EmergencyCountdown) return;
      final left = s.remaining - 1;
      if (left <= 0) {
        _timer?.cancel();
        dispatch();
      } else {
        emit(EmergencyCountdown(
          result: s.result,
          severity: s.severity,
          remaining: left,
          total: s.total,
          severityFromModel: s.severityFromModel,
        ));
      }
    });
  }

  @override
  Future<void> cancel() async {
    final r = _active;
    if (r == null || state is! EmergencyCountdown) return;
    _timer?.cancel();
    final e = _toEvent(r, _activeSeverity, AccidentStatus.cancelled);
    await _persist(e, r.sensorWindow);
    _active = null;
    emit(EmergencyCancelled(e));
  }

  @override
  Future<void> dispatch() async {
    final r = _active;
    if (r == null || state is EmergencyDispatching || state is EmergencyActive) return;
    _timer?.cancel();
    emit(const EmergencyDispatching());

    GeoLocation? loc;
    try {
      loc = await _location.current().timeout(const Duration(seconds: 8));
    } catch (err) {
      debugPrint('SafeDrive: location failed: $err');
    }
    loc ??= r.location;
    final e = _toEvent(r, _activeSeverity, AccidentStatus.dispatched, location: loc);
    await _persist(e, r.sensorWindow);

    final contacts = _contacts.current;
    final message = EmergencyMessage.build(
      severity: _activeSeverity,
      lastSpeedKmh: loc?.speedKmh ?? r.features.speedAfter,
      location: loc,
    );
    DispatchReport report;
    try {
      report = await _dispatcher.notifyContacts(contacts, message);
    } catch (err) {
      debugPrint('SafeDrive: dispatch failed: $err');
      report = DispatchReport(
        push: ChannelStatus.failed,
        smsGateway: ChannelStatus.failed,
        composer: ChannelStatus.needsUserTap,
        details: ['Automatic alert failed ($err) — use the buttons below'],
      );
    }
    unawaited(_events.syncPending().catchError((Object err) {
      debugPrint('SafeDrive: sync failed: $err');
      return 0;
    }));
    emit(EmergencyActive(event: e, message: message, contacts: contacts, report: report));
  }

  /// Driver/bystander closes the Emergency Active screen.
  void resolve() {
    _active = null;
    _activeSeverity = null;
    emit(const EmergencyIdle());
  }

  AccidentEvent _toEvent(
    AccidentEventResult r,
    Severity? severity,
    AccidentStatus status, {
    GeoLocation? location,
  }) {
    final f = r.features;
    final samples = r.sensorWindow.samples;
    double maxGyro = 0;
    for (final s in samples) {
      final g = s.gx * s.gx + s.gy * s.gy + s.gz * s.gz;
      if (g > maxGyro) maxGyro = g;
    }
    return AccidentEvent(
      id: '${r.timestamp.microsecondsSinceEpoch}-${_seq++}',
      timestamp: r.timestamp,
      sessionId: _driving.current.sessionId ?? 'no-session',
      eventClass: r.eventClass,
      confidence: r.confidence,
      severity: severity,
      maxAccel: f.peakAccel,
      maxGyro: math.sqrt(maxGyro),
      speedBefore: f.speedBefore,
      speedAfter: f.speedAfter,
      rollover: r.eventClass == EventClass.possibleRollover || f.orientationDelta >= 90,
      location: location ?? r.location,
      status: status,
      sensorWindowRef: r.sensorWindow.id,
    );
  }

  /// Storage must never block the emergency flow: if saving fails the
  /// countdown / dispatch still continue and the error is logged.
  Future<void> _persist(AccidentEvent e, SensorWindow window) async {
    try {
      await _events.saveLocal(e, window: window);
    } catch (err, st) {
      debugPrint('SafeDrive: saving event failed: $err\n$st');
    }
  }

  @override
  Future<void> close() async {
    _timer?.cancel();
    await _sub.cancel();
    return super.close();
  }
}
