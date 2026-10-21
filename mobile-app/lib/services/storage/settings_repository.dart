// Hazem-owned. App settings.
// UserSettings (countdownSec, confidenceThreshold) syncs to users/{uid}.settings.
// detectionEnabled + onboardingDone are device-local only (not in the shared
// schema, so they never go to Firestore).
// Now: in-memory. Weeks 4–6: persisted with drift.

import 'dart:async';

import 'package:equatable/equatable.dart';

import '../../domain/domain.dart';

class AppSettings extends Equatable {
  const AppSettings({
    this.user = const UserSettings(),
    this.detectionEnabled = true,
    this.onboardingDone = false,
  });

  final UserSettings user;
  final bool detectionEnabled;
  final bool onboardingDone;

  AppSettings copyWith({
    UserSettings? user,
    bool? detectionEnabled,
    bool? onboardingDone,
  }) =>
      AppSettings(
        user: user ?? this.user,
        detectionEnabled: detectionEnabled ?? this.detectionEnabled,
        onboardingDone: onboardingDone ?? this.onboardingDone,
      );

  @override
  List<Object?> get props => [user, detectionEnabled, onboardingDone];
}

abstract interface class SettingsRepository {
  AppSettings get current;
  Stream<AppSettings> watch();
  Future<void> save(AppSettings settings);
}

class InMemorySettingsRepository implements SettingsRepository {
  InMemorySettingsRepository([this._value = const AppSettings()]);

  final _controller = StreamController<AppSettings>.broadcast();
  AppSettings _value;

  @override
  AppSettings get current => _value;

  @override
  Stream<AppSettings> watch() async* {
    yield _value;
    yield* _controller.stream;
  }

  @override
  Future<void> save(AppSettings settings) async {
    _value = settings;
    _controller.add(settings);
  }

  void dispose() => _controller.close();
}
