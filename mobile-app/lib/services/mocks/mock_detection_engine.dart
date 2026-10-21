// TEST-ONLY stand-in for a DetectionEngine (the app uses SensorFusionEngine). Emits realistic-looking
// AccidentEventResult objects on demand so the emergency flow, persistence and
// history screens can be built before the real engine exists (task 7).

import 'dart:async';
import 'dart:math';

import '../../domain/domain.dart';

class MockDetectionEngine implements DetectionEngine {
  final _controller = StreamController<AccidentEventResult>.broadcast();
  int _counter = 0;

  @override
  Stream<AccidentEventResult> get events => _controller.stream;

  /// Fire one fake event of [eventClass].
  AccidentEventResult emit(EventClass eventClass, {GeoLocation? location}) {
    final result = buildResult(eventClass, location: location, id: ++_counter);
    _controller.add(result);
    return result;
  }

  /// Scenario presets (numbers are illustrative, not tuned thresholds).
  static AccidentEventResult buildResult(
    EventClass c, {
    GeoLocation? location,
    int id = 1,
    DateTime? at,
  }) {
    final t = at ?? DateTime.now();
    final p = _presets[c]!;
    return AccidentEventResult(
      eventClass: c,
      confidence: p.confidence,
      timestamp: t,
      location: location ??
          GeoLocation(
            latitude: 30.0444,
            longitude: 31.2357,
            speedKmh: p.speedAfter,
            timestamp: t,
          ),
      features: FeatureVector(
        peakAccel: p.peakG,
        meanAccel: p.peakG / 4,
        stdAccelPerAxis: Axis3(p.peakG / 5, p.peakG / 6, p.peakG / 8),
        jerkMax: p.peakG * 40,
        gyroEnergy: p.peakGyro * p.peakGyro,
        orientationDelta: p.orientationDelta,
        speedBefore: p.speedBefore,
        speedAfter: p.speedAfter,
        deltaV: p.speedBefore - p.speedAfter,
        stopTime: p.speedAfter < 5 ? 1.6 : 0.0,
        postEventMovement: p.speedAfter < 5 ? 2.0 : 150.0,
        eventDuration: p.duration,
        freeFallFlag: false,
        saturationDuration: p.peakG >= 8 ? 0.04 : 0.0,
      ),
      sensorWindow: _syntheticWindow('mock-window-$id', t, p),
    );
  }

  /// ±10 s of 50 Hz fake samples shaped around the event.
  static SensorWindow _syntheticWindow(String id, DateTime t, _Preset p) {
    const hz = 50;
    final samples = <SensorSample>[];
    final rnd = Random(id.hashCode);
    for (var i = -10 * hz; i <= 10 * hz; i++) {
      final s = i / hz; // seconds relative to event
      final pulse = exp(-(s * s) / (2 * pow(p.duration / 2 + 0.01, 2)));
      const g = 9.81;
      final accelG = 1 + (p.peakG - 1) * pulse + (rnd.nextDouble() - 0.5) * 0.1;
      final speed = s < 0
          ? p.speedBefore
          : p.speedAfter + (p.speedBefore - p.speedAfter) * exp(-s * 3);
      samples.add(SensorSample(
        timestamp: t.add(Duration(milliseconds: (s * 1000).round())),
        ax: accelG * g * 0.6,
        ay: accelG * g * 0.3,
        az: accelG * g * 0.74,
        gx: p.peakGyro * pulse * 0.7,
        gy: p.peakGyro * pulse * 0.2,
        gz: p.peakGyro * pulse * 0.1 + (rnd.nextDouble() - 0.5) * 0.02,
        speedKmh: speed,
      ));
    }
    return SensorWindow(id: id, eventTime: t, samples: samples);
  }

  void dispose() => _controller.close();
}

class _Preset {
  const _Preset(this.confidence, this.peakG, this.peakGyro, this.speedBefore,
      this.speedAfter, this.orientationDelta, this.duration);
  final double confidence, peakG, peakGyro, speedBefore, speedAfter;
  final double orientationDelta, duration;
}

const _presets = <EventClass, _Preset>{
  EventClass.normalDriving: _Preset(3, 1.1, 0.1, 60, 60, 0, 0.1),
  EventClass.hardBraking: _Preset(35, 1.0, 0.2, 70, 20, 2, 2.5),
  EventClass.pothole: _Preset(15, 3.0, 0.5, 50, 49, 0, 0.08),
  EventClass.sharpTurn: _Preset(12, 0.8, 1.2, 45, 42, 3, 2.0),
  EventClass.possibleAccident: _Preset(68, 5.0, 2.0, 55, 8, 15, 0.15),
  EventClass.severeAccident: _Preset(94, 8.0, 3.5, 82, 3, 35, 0.2),
  EventClass.possibleRollover: _Preset(91, 8.0, 7.0, 75, 0, 160, 1.2),
};
