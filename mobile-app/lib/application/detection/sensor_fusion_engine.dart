// SensorFusionEngine — reference implementation of the DetectionEngine
// contract (Ahmed's half). It feeds the CrashDetector from:
//   • LIVE phone sensors (sensors_plus accelerometer + gyroscope at ~50 Hz,
//     GPS speed from the DrivingDetector) while a driving session is active;
//   • REPLAYED recordings in Test Mode / demo — the SAME detector decides.
// If Ahmed ships his own engine, it replaces this class in AppServices only.

import 'dart:async';
import 'dart:math' as math;

import 'package:sensors_plus/sensors_plus.dart';

import '../../domain/domain.dart';
import '../test_mode/scenario_runner.dart';
import 'crash_detector.dart';
import 'detection_config.dart';
import 'scenario_generator.dart';

enum EnginePhase { idle, monitoring, replaying, verifying, decided }

class EngineStatus {
  const EngineStatus(this.phase, this.headline, {this.decision, this.scenario});

  final EnginePhase phase;
  final String headline;
  final Decision? decision;
  final Scenario? scenario;
}

/// What the UI can watch (Driving Mode, Test Mode).
abstract interface class DetectionMonitor {
  EngineStatus get currentStatus;
  Stream<EngineStatus> get status;

  /// Replay only: (seconds from start, |a| in g) pairs for the live chart.
  Stream<List<(double, double)>> get signal;
}

class SensorFusionEngine implements DetectionEngine, ScenarioRunner, DetectionMonitor {
  SensorFusionEngine({
    required DrivingDetector driving,
    this.config = const DetectionConfig(),
    this.replaySpeedup = 5,
    this.onReplaySpeed,
    this.locate,
  }) : _driving = driving {
    _detector = CrashDetector(config);
    _drivingSub = _driving.snapshots.listen(_onDriving);
  }

  final DetectionConfig config;
  final DrivingDetector _driving;

  /// Replay runs this many times faster than real time (detector uses the
  /// sample timestamps, so the result is identical).
  final int replaySpeedup;

  /// Lets the (mock) driving detector show the replayed GPS speed.
  final void Function(double? kmh)? onReplaySpeed;

  /// Best-effort location for an event (dispatch fetches a fresh one).
  final Future<GeoLocation?> Function()? locate;

  late final CrashDetector _detector;
  late final StreamSubscription<DrivingSnapshot> _drivingSub;
  final _events = StreamController<AccidentEventResult>.broadcast();
  final _status = StreamController<EngineStatus>.broadcast();
  final _signal = StreamController<List<(double, double)>>.broadcast();

  StreamSubscription<AccelerometerEvent>? _accSub;
  StreamSubscription<GyroscopeEvent>? _gyrSub;
  double _gx = 0, _gy = 0, _gz = 0;
  bool _replaying = false;
  EngineStatus _current = const EngineStatus(EnginePhase.idle, 'Not driving');

  @override
  Stream<AccidentEventResult> get events => _events.stream;

  @override
  EngineStatus get currentStatus => _current;

  @override
  Stream<EngineStatus> get status async* {
    yield _current;
    yield* _status.stream;
  }

  @override
  Stream<List<(double, double)>> get signal => _signal.stream;

  @override
  List<Scenario> get scenarios => Scenario.values;

  void _setStatus(EngineStatus s) {
    _current = s;
    _status.add(s);
  }

  // ------------------------------------------------------------ live mode

  void _onDriving(DrivingSnapshot s) {
    if (s.status == DrivingStatus.driving) {
      _startLive();
    } else {
      _stopLive();
    }
  }

  void _startLive() {
    if (_accSub != null) return;
    _detector.reset();
    if (!_replaying) _setStatus(const EngineStatus(EnginePhase.monitoring, 'Monitoring sensors'));
    try {
      _gyrSub = gyroscopeEventStream(samplingPeriod: SensorInterval.gameInterval).listen(
        (e) {
          _gx = e.x;
          _gy = e.y;
          _gz = e.z;
        },
        onError: (_) {}, // no gyroscope → degrade (file 02 §3)
        cancelOnError: true,
      );
      _accSub = accelerometerEventStream(samplingPeriod: SensorInterval.gameInterval).listen(
        (e) {
          if (_replaying) return; // a replay owns the detector right now
          _feed(SensorSample(
            timestamp: DateTime.now(),
            ax: e.x,
            ay: e.y,
            az: e.z,
            gx: _gx,
            gy: _gy,
            gz: _gz,
            speedKmh: _driving.current.sensors.gps ? _driving.current.speedKmh : null,
          ));
        },
        onError: (_) {},
        cancelOnError: true,
      );
    } catch (_) {
      // Platform without motion sensors (e.g. some desktops/web).
    }
  }

  void _stopLive() {
    _accSub?.cancel();
    _gyrSub?.cancel();
    _accSub = null;
    _gyrSub = null;
    if (!_replaying) _setStatus(const EngineStatus(EnginePhase.idle, 'Not driving'));
  }

  // ------------------------------------------------------------ replay mode

  @override
  Future<void> run(Scenario scenario) async {
    if (_replaying) return;
    _replaying = true;
    _detector.reset();
    final start = DateTime.now();
    final samples = ScenarioGenerator.generate(scenario, start: start, seed: start.millisecond + 1);
    _setStatus(EngineStatus(EnginePhase.replaying, 'Replaying "${scenario.label}" sensor data',
        scenario: scenario));

    Decision? decision;
    final done = Completer<void>();
    var i = 0;
    final perTick = replaySpeedup; // 20 ms tick × speed-up samples (50 Hz data)
    Timer.periodic(const Duration(milliseconds: 20), (timer) {
      final batch = <(double, double)>[];
      for (var k = 0; k < perTick && i < samples.length; k++, i++) {
        final s = samples[i];
        final d = _feed(s, scenario: scenario);
        decision ??= d;
        final t = s.timestamp.difference(start).inMicroseconds / 1e6;
        batch.add((t, _magG(s)));
      }
      if (batch.isNotEmpty) {
        _signal.add(batch);
        onReplaySpeed?.call(samples[i - 1].speedKmh);
      }
      if (i >= samples.length) {
        timer.cancel();
        done.complete();
      }
    });
    await done.future;

    onReplaySpeed?.call(null);
    _replaying = false;
    _detector.reset();
    if (decision == null) {
      _setStatus(EngineStatus(EnginePhase.decided, 'No event detected — normal driving',
          scenario: scenario));
    }
    if (_accSub != null) {
      // Back to live monitoring after a short pause so the result stays visible.
      Future<void>.delayed(const Duration(seconds: 4), () {
        if (!_replaying && _accSub != null) {
          _setStatus(const EngineStatus(EnginePhase.monitoring, 'Monitoring sensors'));
        }
      });
    }
  }

  static double _magG(SensorSample s) =>
      math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az) / 9.81;

  // ------------------------------------------------------------ shared

  Decision? _feed(SensorSample s, {Scenario? scenario}) {
    final ev = _detector.push(s);
    switch (ev) {
      case final Triggered t:
        _setStatus(EngineStatus(EnginePhase.verifying,
            '${t.description} → verifying ±${config.postWindowSec.round()} s',
            scenario: scenario));
        return null;
      case final Decision d:
        _setStatus(EngineStatus(EnginePhase.decided, d.label, decision: d, scenario: scenario));
        _publish(d);
        return d;
      case null:
        return null;
    }
  }

  Future<void> _publish(Decision d) async {
    final cls = d.eventClass;
    if (cls == null) return; // normal driving / phone drop → nothing to report
    GeoLocation? loc;
    try {
      loc = await locate?.call().timeout(const Duration(seconds: 3));
    } catch (_) {}
    _events.add(AccidentEventResult(
      eventClass: cls,
      confidence: d.confidence,
      features: d.features,
      sensorWindow: d.window,
      timestamp: d.window.eventTime,
      location: loc,
    ));
  }

  void dispose() {
    _drivingSub.cancel();
    _stopLive();
    _events.close();
    _status.close();
    _signal.close();
  }
}
