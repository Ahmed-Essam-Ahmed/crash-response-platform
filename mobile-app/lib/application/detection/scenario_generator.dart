// Recorded-style sensor streams for Test Mode (FR-15).
//
// Each scenario is 25 s of 50 Hz phone data (accelerometer m/s², gyroscope
// rad/s, GPS speed held at 1 Hz like a real receiver) with the event at 12 s.
// The phone sits in a car mount (gravity on its z axis). Shapes follow file 02
// §4: braking is sustained ~0.7 g, a pothole is a <100 ms vertical spike, a
// phone drop has ~0.4 s of free fall first, a crash clips the ±8 g sensor and
// the GPS speed collapses. These are SYNTHETIC stand-ins until our own field
// recordings exist — the detector cannot tell the difference.

import 'dart:math' as math;

import '../../domain/domain.dart';

enum Scenario {
  normalDriving('Normal Driving'),
  hardBraking('Hard Braking'),
  pothole('Pothole'),
  sharpTurn('Sharp Turn'),
  phoneDrop('Phone Drop'),
  severeImpact('Severe Impact'),
  rollover('Rollover');

  const Scenario(this.label);
  final String label;
}

class ScenarioGenerator {
  static const hz = 50;
  static const durationSec = 25.0;
  static const eventAtSec = 12.0;
  static const _g = 9.81;
  static const _clipG = 8.0;

  static List<SensorSample> generate(Scenario s, {required DateTime start, int seed = 1}) {
    final rnd = math.Random(seed);
    double gauss(double sd) {
      // Box–Muller
      final u1 = math.max(rnd.nextDouble(), 1e-12), u2 = rnd.nextDouble();
      return sd * math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2);
    }

    final n = (durationSec * hz).round();
    final out = <SensorSample>[];
    double? heldSpeed;
    var heldSecond = -1;

    for (var i = 0; i < n; i++) {
      final t = i / hz;
      final rel = t - eventAtSec;
      var grav = [0.0, 0.0, 1.0];
      final dyn = [0.0, 0.0, 0.0];
      final gyr = [0.0, 0.0, 0.0];
      var speed = 60.0;

      switch (s) {
        case Scenario.normalDriving:
          speed = 60.0 + 3.0 * math.sin(t / 3);
        case Scenario.hardBraking:
          speed = rel < 0 ? 70.0 : math.max(5.0, 70.0 - 25.0 * rel);
          if (rel >= 0 && rel < 2.6) dyn[1] = -0.72;
        case Scenario.pothole:
          speed = 50.0;
          if (rel >= 0 && rel < 0.06) dyn[2] = 2.4;
          if (rel >= 0.06 && rel < 0.1) dyn[2] = -1.0;
        case Scenario.sharpTurn:
          speed = rel < 0 ? 45.0 : 45.0 - 1.5 * math.min(rel, 3.0);
          if (rel >= 0 && rel < 3) {
            dyn[0] = 0.45;
            gyr[2] = 0.8;
          }
        case Scenario.phoneDrop:
          speed = 50.0;
          if (rel >= -0.4 && rel < 0) {
            grav = [0.0, 0.0, 0.0];
            dyn[2] = 0.03;
          } else if (rel >= 0 && rel < 0.03) {
            dyn[2] = 5.0;
          } else if (rel >= 0.03) {
            grav = [0.0, -1.0, 0.0]; // lands on its side in the footwell
          }
        case Scenario.severeImpact:
          speed = rel < 1 ? 82.0 : rel < 2 ? 30.0 : rel < 3 ? 3.0 : 0.0;
          if (rel >= 0 && rel < 0.12) dyn[1] = -9.5;
          if (rel >= 0 && rel < 0.3) gyr[2] = 3.0;
          if (rel >= 0.12) grav = [0.25, 0.0, 0.97];
        case Scenario.rollover:
          speed = rel < 1 ? 75.0 : rel < 2 ? 20.0 : 0.0;
          if (rel >= 0 && rel < 0.1) dyn[0] = 5.0;
          if (rel >= 0 && rel < 1.0) {
            gyr[0] = 3.5;
            final a = 3.5 * rel;
            grav = [0.0, math.sin(a), math.cos(a)];
          }
          if (rel >= 1.0) grav = [0.0, 1.0, 0.0];
      }

      double axis(int k) =>
          ((grav[k] + dyn[k]) * _g + gauss(0.4)).clamp(-_clipG * _g, _clipG * _g).toDouble();

      // GPS receivers report about once per second.
      if (t.floor() != heldSecond) {
        heldSecond = t.floor();
        heldSpeed = speed;
      }

      out.add(SensorSample(
        timestamp: start.add(Duration(microseconds: (t * 1e6).round())),
        ax: axis(0),
        ay: axis(1),
        az: axis(2),
        gx: gyr[0] + gauss(0.03),
        gy: gyr[1] + gauss(0.03),
        gz: gyr[2] + gauss(0.03),
        speedKmh: heldSpeed,
      ));
    }
    return out;
  }
}
