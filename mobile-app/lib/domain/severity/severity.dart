// CONTRACT FILE — severity from the external AI model (file 02 §6.4).

import 'package:equatable/equatable.dart';

import '../detection/feature_vector.dart';

enum SeverityLevel { low, medium, high }

class Severity extends Equatable {
  const Severity({required this.level, required this.score});

  final SeverityLevel level;

  /// Model score. Range to be agreed with the ML teammate (draft: 0–1).
  final double score;

  bool get isHigh => level == SeverityLevel.high;

  @override
  List<Object?> get props => [level, score];
}

/// Black box around the teammate's model. On-device (TFLite) or HTTPS API —
/// hidden behind this interface. Throws if the model is unreachable; the caller
/// then falls back to the rule-based Crash Confidence.
abstract interface class SeverityModelClient {
  Future<Severity> getSeverity(FeatureVector f);
}
