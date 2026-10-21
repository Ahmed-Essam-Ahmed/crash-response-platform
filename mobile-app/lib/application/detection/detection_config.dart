// All detection thresholds in ONE externalized table (file 02 §4).
// Every value here is an EXPERIMENTAL parameter, to be tuned from our own
// recorded dataset — not a universally correct number.

class DetectionConfig {
  const DetectionConfig({
    this.impactTriggerG = 2.5,
    this.sustainedAccelG = 0.55,
    this.sustainedAccelSec = 0.5,
    this.sustainedYawRad = 0.6,
    this.sustainedYawSec = 1.0,
    this.gravityTauSec = 5.0,
    this.preWindowSec = 10,
    this.postWindowSec = 10,
    this.bufferSec = 30,
    this.cooldownSec = 12,
    this.saturationG = 7.8,
    this.freeFallG = 0.35,
    this.freeFallSec = 0.2,
    this.severePeakG = 4.0,
    this.severeDeltaV = 40,
    this.severeSpeedAfter = 10,
    this.possibleDeltaV = 20,
    this.potholeMaxDuration = 0.15,
    this.rolloverRotationDeg = 90,
    this.rolloverOrientationDeg = 60,
  });

  // ---- Stage 1: trigger (deliberately sensitive) ----
  /// Acceleration magnitude that counts as an impact.
  final double impactTriggerG;

  /// Gravity-removed acceleration held this long → braking/acceleration event.
  final double sustainedAccelG;
  final double sustainedAccelSec;

  /// Angular velocity held this long → turning event.
  final double sustainedYawRad;
  final double sustainedYawSec;

  /// Low-pass time constant used to estimate the gravity vector.
  final double gravityTauSec;

  // ---- Stage 2: verification window ----
  final double preWindowSec;
  final double postWindowSec;

  /// Ring buffer length kept in memory (file 02 asks ≥ 2 min in production;
  /// 30 s is enough for a ±10 s window).
  final double bufferSec;
  final double cooldownSec;

  // ---- Feature thresholds ----
  /// Phone accelerometers clip at ±8 g (or ±16 g); values here are "saturated".
  final double saturationG;
  final double freeFallG;
  final double freeFallSec;

  // ---- Classification ----
  final double severePeakG;
  final double severeDeltaV;
  final double severeSpeedAfter;
  final double possibleDeltaV;
  final double potholeMaxDuration;
  final double rolloverRotationDeg;
  final double rolloverOrientationDeg;
}
