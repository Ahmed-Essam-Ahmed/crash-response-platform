import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../services/storage/settings_repository.dart';

class SettingsCubit extends Cubit<AppSettings> {
  SettingsCubit(this._repo) : super(_repo.current) {
    _sub = _repo.watch().listen(emit);
  }

  static const minCountdown = 10;
  static const maxCountdown = 60;
  static const minThreshold = 50;
  static const maxThreshold = 95;

  final SettingsRepository _repo;
  late final StreamSubscription<AppSettings> _sub;

  Future<void> setCountdown(int seconds) => _repo.save(state.copyWith(
        user: state.user.copyWith(
          countdownSec: seconds.clamp(minCountdown, maxCountdown),
        ),
      ));

  Future<void> setThreshold(int value) => _repo.save(state.copyWith(
        user: state.user.copyWith(
          confidenceThreshold: value.clamp(minThreshold, maxThreshold),
        ),
      ));

  Future<void> setDetectionEnabled(bool on) =>
      _repo.save(state.copyWith(detectionEnabled: on));

  Future<void> completeOnboarding() =>
      _repo.save(state.copyWith(onboardingDone: true));

  @override
  Future<void> close() async {
    await _sub.cancel();
    return super.close();
  }
}
