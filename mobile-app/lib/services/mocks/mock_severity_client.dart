// TEMPORARY stand-in for the ML teammate's severity model.

import '../../domain/domain.dart';

class MockSeverityModelClient implements SeverityModelClient {
  MockSeverityModelClient({this.reachable = true});

  /// Set false to demo the offline fallback (rule-based confidence).
  bool reachable;

  @override
  Future<Severity> getSeverity(FeatureVector f) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (!reachable) throw StateError('Severity model unreachable');
    // Crude stand-in: delta-v and peak g drive the score.
    final score = ((f.deltaV / 80) * 0.6 + (f.peakAccel / 8) * 0.4).clamp(0.0, 1.0);
    final level = score >= 0.7
        ? SeverityLevel.high
        : score >= 0.4
            ? SeverityLevel.medium
            : SeverityLevel.low;
    return Severity(level: level, score: score);
  }
}
