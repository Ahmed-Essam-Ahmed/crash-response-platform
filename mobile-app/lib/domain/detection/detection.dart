// CONTRACT FILE — detection output + the streams Member A exposes.
// AccidentEventResult is file 02 §6.2. DetectionEngine / DrivingDetector are the
// "DetectionEngine → EmergencyController event stream" and the DrivingDetector
// stream named in file 02 §2 and §6 — their exact shape is a DRAFT for Week 1.

import 'package:equatable/equatable.dart';

import '../entities/entities.dart';
import 'event_class.dart';
import 'feature_vector.dart';

/// What Ahmed's engine emits after Stage 2 verification.
class AccidentEventResult extends Equatable {
  const AccidentEventResult({
    required this.eventClass,
    required this.confidence,
    required this.features,
    required this.sensorWindow,
    required this.timestamp,
    this.location,
  });

  final EventClass eventClass;

  /// Crash Confidence 0–100.
  final double confidence;
  final FeatureVector features;
  final SensorWindow sensorWindow;
  final DateTime timestamp;
  final GeoLocation? location;

  @override
  List<Object?> get props =>
      [eventClass, confidence, features, sensorWindow, timestamp, location];
}

/// Member A implements this. Member B (EmergencyController, persistence)
/// only subscribes.
abstract interface class DetectionEngine {
  Stream<AccidentEventResult> get events;
}

enum DrivingStatus { idle, driving }

/// Which sensors this phone actually has (file 02 §3 fallbacks).
class SensorAvailability extends Equatable {
  const SensorAvailability({
    required this.accelerometer,
    required this.gyroscope,
    required this.gps,
    this.barometer = false,
  });

  final bool accelerometer;
  final bool gyroscope;
  final bool gps;
  final bool barometer;

  /// Accelerometer is mandatory — no driving mode without it.
  bool get canMonitor => accelerometer;

  @override
  List<Object?> get props => [accelerometer, gyroscope, gps, barometer];
}

/// Live driving state for the dashboard and Driving Mode screen.
class DrivingSnapshot extends Equatable {
  const DrivingSnapshot({
    required this.status,
    required this.sensors,
    this.speedKmh = 0,
    this.autoDetected = false,
    this.sessionId,
  });

  final DrivingStatus status;
  final SensorAvailability sensors;
  final double speedKmh;

  /// true = started by automatic detection, false = manual override.
  final bool autoDetected;
  final String? sessionId;

  @override
  List<Object?> get props => [status, sensors, speedKmh, autoDetected, sessionId];
}

/// Member A implements this (auto start/stop: speed + activity + dwell).
abstract interface class DrivingDetector {
  DrivingSnapshot get current;
  Stream<DrivingSnapshot> get snapshots;

  /// Manual override (locked decision 1: available, not required).
  Future<void> startManual();
  Future<void> stopManual();
}
