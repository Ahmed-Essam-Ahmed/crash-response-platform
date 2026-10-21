// TEMPORARY stand-in for Ahmed's DrivingDetector until his real one lands.
// It implements the contract interface, so swapping it later changes nothing
// in the UI.

import 'dart:async';
import 'dart:math';

import '../../domain/domain.dart';

class MockDrivingDetector implements DrivingDetector {
  MockDrivingDetector({
    this.sensors = const SensorAvailability(
      accelerometer: true,
      gyroscope: true,
      gps: true,
    ),
  }) : _current = DrivingSnapshot(status: DrivingStatus.idle, sensors: sensors);

  final SensorAvailability sensors;
  final _controller = StreamController<DrivingSnapshot>.broadcast();
  final _random = Random();
  DrivingSnapshot _current;
  Timer? _timer;
  int _sessionCounter = 0;

  @override
  DrivingSnapshot get current => _current;

  @override
  Stream<DrivingSnapshot> get snapshots async* {
    yield _current;
    yield* _controller.stream;
  }

  void _emit(DrivingSnapshot s) {
    _current = s;
    _controller.add(s);
  }

  @override
  Future<void> startManual() async => _start(auto: false);

  /// Simulates the automatic start (sustained speed > 20 km/h).
  Future<void> simulateAutoStart() async => _start(auto: true);

  void _start({required bool auto}) {
    if (_current.status == DrivingStatus.driving) return;
    _sessionCounter++;
    _emit(DrivingSnapshot(
      status: DrivingStatus.driving,
      sensors: sensors,
      speedKmh: auto ? 22 : 0,
      autoDetected: auto,
      sessionId: 'mock-session-$_sessionCounter',
    ));
    // Fake GPS speed at 1 Hz, drifting toward ~70 km/h.
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_override != null) return;
      final v = _current.speedKmh;
      final next = (v + (70 - v) * 0.15 + (_random.nextDouble() * 4 - 2))
          .clamp(0, 140)
          .toDouble();
      _emit(DrivingSnapshot(
        status: DrivingStatus.driving,
        sensors: sensors,
        speedKmh: next,
        autoDetected: _current.autoDetected,
        sessionId: _current.sessionId,
      ));
    });
  }

  double? _override;

  /// Test Mode / demo: show the replayed GPS speed instead of the fake drift.
  void overrideSpeed(double? kmh) {
    _override = kmh;
    if (kmh != null && _current.status == DrivingStatus.driving) {
      _emit(DrivingSnapshot(
        status: DrivingStatus.driving,
        sensors: sensors,
        speedKmh: kmh,
        autoDetected: _current.autoDetected,
        sessionId: _current.sessionId,
      ));
    }
  }

  @override
  Future<void> stopManual() async {
    _timer?.cancel();
    _timer = null;
    _emit(DrivingSnapshot(status: DrivingStatus.idle, sensors: sensors));
  }

  void dispose() {
    _timer?.cancel();
    _controller.close();
  }
}
