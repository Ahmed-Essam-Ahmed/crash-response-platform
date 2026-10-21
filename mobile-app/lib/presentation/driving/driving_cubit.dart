import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/domain.dart';

/// Mirrors the DrivingDetector stream into UI state. App-wide (one instance).
class DrivingCubit extends Cubit<DrivingSnapshot> {
  DrivingCubit(this._detector) : super(_detector.current) {
    _sub = _detector.snapshots.listen(emit);
  }

  final DrivingDetector _detector;
  late final StreamSubscription<DrivingSnapshot> _sub;

  Future<void> startManual() => _detector.startManual();
  Future<void> stopManual() => _detector.stopManual();

  @override
  Future<void> close() async {
    await _sub.cancel();
    return super.close();
  }
}
