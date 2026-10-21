// Two-stage multi-sensor fusion detector (file 02 §4).
//
//   Stage 1 (every sample, cheap): impact > 2.5 g, OR sustained
//            gravity-removed acceleration, OR sustained rotation  → trigger
//   Stage 2 (±10 s around the trigger): extract the FeatureVector, score the
//            Crash Confidence (weighted evidence − penalties) and classify.
//
// Pure Dart, no Flutter, no plugins → unit-testable and identical for live
// sensors and for replayed recordings (Test Mode).

import 'dart:collection';
import 'dart:math' as math;

import '../../domain/domain.dart';
import 'detection_config.dart';

const _g = 9.81;

enum TriggerKind { impact, sustainedAccel, sustainedRotation }

/// Something the detector reports while processing samples.
sealed class DetectorEvent {
  const DetectorEvent();
}

class Triggered extends DetectorEvent {
  const Triggered(this.kind, this.t0, this.description);
  final TriggerKind kind;

  /// Seconds since epoch of the trigger (window centre).
  final double t0;
  final String description;
}

class Decision extends DetectorEvent {
  const Decision({
    required this.eventClass,
    required this.phoneDrop,
    required this.confidence,
    required this.features,
    required this.window,
    required this.trigger,
    required this.rotationDeg,
    required this.reasons,
  });

  /// null = no road event worth reporting (normal driving / phone drop).
  final EventClass? eventClass;
  final bool phoneDrop;
  final double confidence;
  final FeatureVector features;
  final SensorWindow window;
  final Triggered trigger;
  final double rotationDeg;

  /// Human-readable evidence — why the engine decided this.
  final List<String> reasons;

  String get label => phoneDrop
      ? 'Phone dropped — not an accident'
      : eventClass?.label ?? 'Normal driving — no event';
}

class CrashDetector {
  CrashDetector([this.cfg = const DetectionConfig()]);

  final DetectionConfig cfg;
  final _buf = ListQueue<SensorSample>();
  List<double>? _grav;
  double? _lastT;
  double? _accelSince;
  double? _yawSince;
  Triggered? _pending;
  double _cooldownUntil = -1e18;
  int _windowSeq = 0;

  static double _t(DateTime d) => d.microsecondsSinceEpoch / 1e6;
  static double _norm(double x, double y, double z) => math.sqrt(x * x + y * y + z * z);

  bool get isVerifying => _pending != null;

  void reset() {
    _buf.clear();
    _grav = null;
    _lastT = null;
    _accelSince = null;
    _yawSince = null;
    _pending = null;
    _cooldownUntil = -1e18;
  }

  /// Feed one sample. Returns a [Triggered] when Stage 1 fires and a
  /// [Decision] when Stage 2 finishes (10 s after the trigger).
  DetectorEvent? push(SensorSample s) {
    final t = _t(s.timestamp);
    _buf.add(s);
    while (_buf.isNotEmpty && _t(_buf.first.timestamp) < t - cfg.bufferSec) {
      _buf.removeFirst();
    }

    // Gravity estimate (slow low-pass) → gravity-removed "dynamic" accel.
    final dt = _lastT == null ? 0.02 : (t - _lastT!).clamp(0.001, 0.5).toDouble();
    _lastT = t;
    final alpha = dt / (cfg.gravityTauSec + dt);
    final g = _grav ??= [s.ax, s.ay, s.az];
    g[0] = g[0] * (1 - alpha) + s.ax * alpha;
    g[1] = g[1] * (1 - alpha) + s.ay * alpha;
    g[2] = g[2] * (1 - alpha) + s.az * alpha;

    final mag = _norm(s.ax, s.ay, s.az) / _g;
    final dyn = _norm(s.ax - g[0], s.ay - g[1], s.az - g[2]) / _g;
    final gyro = _norm(s.gx, s.gy, s.gz);
    _accelSince = dyn > cfg.sustainedAccelG ? (_accelSince ?? t) : null;
    _yawSince = gyro > cfg.sustainedYawRad ? (_yawSince ?? t) : null;

    DetectorEvent? out;
    if (_pending == null && t >= _cooldownUntil) {
      Triggered? trig;
      if (mag > cfg.impactTriggerG) {
        trig = Triggered(TriggerKind.impact, t, 'Impact ${mag.toStringAsFixed(1)} g');
      } else if (_accelSince != null && t - _accelSince! >= cfg.sustainedAccelSec) {
        trig = Triggered(TriggerKind.sustainedAccel, _accelSince!,
            'Sustained ${dyn.toStringAsFixed(2)} g deceleration/acceleration');
      } else if (_yawSince != null && t - _yawSince! >= cfg.sustainedYawSec) {
        trig = Triggered(TriggerKind.sustainedRotation, _yawSince!,
            'Sustained rotation ${gyro.toStringAsFixed(1)} rad/s');
      }
      if (trig != null) {
        _pending = trig;
        _cooldownUntil = t + cfg.cooldownSec;
        out = trig;
      }
    }

    final p = _pending;
    if (p != null && t >= p.t0 + cfg.postWindowSec) {
      _pending = null;
      return _analyze(p);
    }
    return out;
  }

  // ------------------------------------------------------------ Stage 2

  Decision _analyze(Triggered p) {
    final t0 = p.t0;
    final all = _buf.toList();
    double rel(SensorSample s) => _t(s.timestamp) - t0;
    List<SensorSample> win(double a, double b) =>
        all.where((s) => rel(s) >= a && rel(s) < b).toList();
    double magOf(SensorSample s) => _norm(s.ax, s.ay, s.az) / _g;
    double mean(Iterable<double> v) => v.isEmpty ? 0 : v.reduce((a, b) => a + b) / v.length;

    final w = win(-cfg.preWindowSec, cfg.postWindowSec);
    final mags = [for (final s in w) magOf(s)];
    final rels = [for (final s in w) rel(s)];

    // Impact
    var peak = 0.0, dur = 0.0, sat = 0.0, jerk = 0.0;
    for (var i = 0; i < w.length; i++) {
      final dtI = i == 0 ? 0.02 : (rels[i] - rels[i - 1]).clamp(0.001, 0.1).toDouble();
      if (rels[i] >= -1 && rels[i] < 2) {
        if (mags[i] > peak) peak = mags[i];
        if (mags[i] > 2.0) dur += dtI;
      }
      if (mags[i] >= cfg.saturationG) sat += dtI;
      if (i > 0) jerk = math.max(jerk, (mags[i] - mags[i - 1]).abs() / dtI);
    }

    // Per-axis spread (g)
    double std(Iterable<double> v) {
      final m = mean(v);
      return math.sqrt(mean(v.map((x) => (x - m) * (x - m))));
    }

    final stdAxis = Axis3(
      std(w.map((s) => s.ax / _g)),
      std(w.map((s) => s.ay / _g)),
      std(w.map((s) => s.az / _g)),
    );

    // Orientation change: mean gravity vector before vs after.
    List<double> meanVec(List<SensorSample> v) => [
          mean(v.map((s) => s.ax)),
          mean(v.map((s) => s.ay)),
          mean(v.map((s) => s.az)),
        ];
    final gb = meanVec(win(-cfg.preWindowSec, -2));
    final ga = meanVec(win(3, cfg.postWindowSec));
    final nb = _norm(gb[0], gb[1], gb[2]), na = _norm(ga[0], ga[1], ga[2]);
    var orient = 0.0;
    if (nb > 0 && na > 0) {
      final c = ((gb[0] * ga[0] + gb[1] * ga[1] + gb[2] * ga[2]) / (nb * na)).clamp(-1.0, 1.0);
      orient = math.acos(c) * 180 / math.pi;
    }

    // GPS: speed before / after (delta-v is the strongest crash indicator).
    final sb = win(-5, -1).map((s) => s.speedKmh).whereType<double>().toList();
    final sa = win(3, cfg.postWindowSec).map((s) => s.speedKmh).whereType<double>().toList();
    final hasGps = sb.isNotEmpty && sa.isNotEmpty;
    final vb = mean(sb), va = mean(sa), dv = hasGps ? vb - va : 0.0;
    final post = mean(sa) / 3.6 * (cfg.postWindowSec - 3);
    var stopTime = cfg.postWindowSec;
    for (final s in win(0, cfg.postWindowSec)) {
      if ((s.speedKmh ?? 99) < 5) {
        stopTime = rel(s);
        break;
      }
    }

    // Rotation integrated over the event, and gyro energy.
    var rot = 0.0, gyroEnergy = 0.0;
    double? prev;
    for (final s in win(-1, 3)) {
      final r = rel(s);
      final dtI = prev == null ? 0.02 : (r - prev).clamp(0.001, 0.1).toDouble();
      prev = r;
      final om = _norm(s.gx, s.gy, s.gz);
      gyroEnergy += om * om * dtI;
      if (r >= -0.5) rot += om * dtI;
    }
    final rotDeg = rot * 180 / math.pi;

    // Free fall just before the spike = phone drop signature.
    var ff = false;
    double? ffStart;
    for (var i = 0; i < w.length; i++) {
      if (rels[i] < -1.5 || rels[i] >= 0.05) continue;
      if (mags[i] < cfg.freeFallG) {
        ffStart ??= rels[i];
        if (rels[i] - ffStart >= cfg.freeFallSec) ff = true;
      } else {
        ffStart = null;
      }
    }

    // ---- Crash Confidence = Σ wᵢ·fᵢ − penalties
    double c01(double x) => x.clamp(0.0, 1.0).toDouble();
    var conf = 0.25 * c01((peak - 2) / 6) +
        0.30 * c01(dv / 60) +
        0.15 * (va < 5 ? 1 : c01(1 - va / 30)) +
        0.10 * c01(orient / 90) +
        0.10 * c01(1 - post / 50) +
        0.10 * (rotDeg >= cfg.rolloverRotationDeg ? 1 : 0);
    if (ff) conf -= 0.4;
    if (dv < 5) conf -= 0.3;
    final confidence = c01(conf) * 100;

    // ---- Classification (rules from file 02 §4)
    EventClass? cls;
    var phoneDrop = false;
    if (ff && dv.abs() < 5) {
      phoneDrop = true;
    } else if (rotDeg >= cfg.rolloverRotationDeg &&
        orient >= cfg.rolloverOrientationDeg &&
        dv >= cfg.possibleDeltaV) {
      cls = EventClass.possibleRollover;
    } else if ((peak >= cfg.severePeakG || sat > 0) &&
        dv >= cfg.severeDeltaV &&
        va < cfg.severeSpeedAfter) {
      cls = EventClass.severeAccident;
    } else if (peak >= cfg.impactTriggerG && dv >= cfg.possibleDeltaV) {
      cls = EventClass.possibleAccident;
    } else if (peak >= cfg.impactTriggerG && dv < 10 && dur < cfg.potholeMaxDuration) {
      cls = EventClass.pothole;
    } else if (p.kind == TriggerKind.sustainedRotation && dv < 15) {
      cls = EventClass.sharpTurn;
    } else if (p.kind == TriggerKind.sustainedAccel && dv >= 10) {
      cls = EventClass.hardBraking;
    }

    // ---- Evidence for the UI / report
    final reasons = <String>[
      'Stage 1 trigger: ${p.description}',
      'Peak acceleration ${peak.toStringAsFixed(1)} g'
          '${sat > 0 ? ' (sensor saturated ${(sat * 1000).round()} ms)' : ''}',
      if (hasGps)
        'GPS speed ${vb.round()} → ${va.round()} km/h (ΔV ${dv.round()} km/h)'
      else
        'No GPS — motion-only, low confidence',
      if (va < 5 && hasGps) 'Vehicle stationary after the event',
      'Orientation change ${orient.round()}°, rotation ${rotDeg.round()}°',
      if (ff) 'Free fall before the spike → phone was dropped',
      if (dv < 5 && hasGps) 'Speed unchanged → the vehicle did not crash',
      if (cls == EventClass.pothole) 'Very short vertical spike (${(dur * 1000).round()} ms)',
    ];

    final features = FeatureVector(
      peakAccel: peak,
      meanAccel: mean(mags),
      stdAccelPerAxis: stdAxis,
      jerkMax: jerk,
      gyroEnergy: gyroEnergy,
      orientationDelta: orient,
      speedBefore: vb,
      speedAfter: va,
      deltaV: dv,
      stopTime: stopTime,
      postEventMovement: post,
      eventDuration: dur,
      freeFallFlag: ff,
      saturationDuration: sat,
    );

    return Decision(
      eventClass: cls,
      phoneDrop: phoneDrop,
      confidence: confidence,
      features: features,
      window: SensorWindow(
        id: 'win-${(t0 * 1000).round()}-${_windowSeq++}',
        eventTime: DateTime.fromMicrosecondsSinceEpoch((t0 * 1e6).round()),
        samples: w,
      ),
      trigger: p,
      rotationDeg: rotDeg,
      reasons: reasons,
    );
  }
}
