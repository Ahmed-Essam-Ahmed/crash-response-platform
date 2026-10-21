import 'package:flutter_bloc/flutter_bloc.dart';

import '../../application/app_services.dart';

enum SplashState { loading, goOnboarding, goHome, failed }

class SplashCubit extends Cubit<SplashState> {
  SplashCubit(this._services) : super(SplashState.loading);

  final AppServices _services;

  Future<void> init() async {
    try {
      await _services.init();
      emit(_services.settings.current.onboardingDone
          ? SplashState.goHome
          : SplashState.goOnboarding);
    } catch (_) {
      emit(SplashState.failed);
    }
  }
}
