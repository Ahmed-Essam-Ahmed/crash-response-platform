// CONTRACT FILE — FeatureVector (file 02 §6.3).
// This is ALSO the input schema of the external severity model.
// Owned by Ahmed together with the ML teammate. Do not edit alone.

import 'package:equatable/equatable.dart';

/// Per-axis value (x, y, z).
class Axis3 extends Equatable {
  const Axis3(this.x, this.y, this.z);

  final double x, y, z;

  Map<String, double> toJson() => {'x': x, 'y': y, 'z': z};

  @override
  List<Object?> get props => [x, y, z];
}

/// Units below are a DRAFT — confirm with Ahmed in Week 1.
class FeatureVector extends Equatable {
  const FeatureVector({
    required this.peakAccel,
    required this.meanAccel,
    required this.stdAccelPerAxis,
    required this.jerkMax,
    required this.gyroEnergy,
    required this.orientationDelta,
    required this.speedBefore,
    required this.speedAfter,
    required this.deltaV,
    required this.stopTime,
    required this.postEventMovement,
    required this.eventDuration,
    required this.freeFallFlag,
    required this.saturationDuration,
  });

  /// g
  final double peakAccel;

  /// g
  final double meanAccel;

  /// g, per axis
  final Axis3 stdAccelPerAxis;

  /// g/s
  final double jerkMax;

  /// Σ|ω|² over the window, (rad/s)²
  final double gyroEnergy;

  /// Angle between gravity vector before and after, degrees
  final double orientationDelta;

  /// km/h
  final double speedBefore;

  /// km/h
  final double speedAfter;

  /// km/h (speedBefore − speedAfter)
  final double deltaV;

  /// Seconds from impact until speed ≈ 0
  final double stopTime;

  /// Metres moved after the event
  final double postEventMovement;

  /// Seconds the trigger condition lasted
  final double eventDuration;

  /// Near-0 g free fall seen before the spike (phone drop signature)
  final bool freeFallFlag;

  /// Seconds the accelerometer was clipped at its max range
  final double saturationDuration;

  /// Payload sent to the severity model if it is API-hosted.
  Map<String, Object> toJson() => {
        'peakAccel': peakAccel,
        'meanAccel': meanAccel,
        'stdAccelPerAxis': stdAccelPerAxis.toJson(),
        'jerkMax': jerkMax,
        'gyroEnergy': gyroEnergy,
        'orientationDelta': orientationDelta,
        'speedBefore': speedBefore,
        'speedAfter': speedAfter,
        'deltaV': deltaV,
        'stopTime': stopTime,
        'postEventMovement': postEventMovement,
        'eventDuration': eventDuration,
        'freeFallFlag': freeFallFlag,
        'saturationDuration': saturationDuration,
      };

  @override
  List<Object?> get props => [
        peakAccel,
        meanAccel,
        stdAccelPerAxis,
        jerkMax,
        gyroEnergy,
        orientationDelta,
        speedBefore,
        speedAfter,
        deltaV,
        stopTime,
        postEventMovement,
        eventDuration,
        freeFallFlag,
        saturationDuration,
      ];
}
