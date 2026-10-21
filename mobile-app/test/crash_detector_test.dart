import 'package:flutter_test/flutter_test.dart';
import 'package:safedrive/application/detection/crash_detector.dart';
import 'package:safedrive/application/detection/scenario_generator.dart';
import 'package:safedrive/domain/domain.dart';

Decision? runScenario(Scenario s, {int seed = 1}) {
  final d = CrashDetector();
  Decision? out;
  for (final sample in ScenarioGenerator.generate(s, start: DateTime(2026, 10, 15), seed: seed)) {
    final ev = d.push(sample);
    if (ev is Decision) out ??= ev;
  }
  return out;
}

void main() {
  for (final seed in [1, 2, 3]) {
    group('seed $seed', () {
      test('normal driving → no trigger at all', () {
        expect(runScenario(Scenario.normalDriving, seed: seed), isNull);
      });

      test('hard braking → hardBraking, no alert', () {
        final d = runScenario(Scenario.hardBraking, seed: seed)!;
        expect(d.eventClass, EventClass.hardBraking);
        expect(d.eventClass!.isAccident, isFalse);
      });

      test('pothole → pothole (short spike, speed unchanged)', () {
        final d = runScenario(Scenario.pothole, seed: seed)!;
        expect(d.eventClass, EventClass.pothole);
        expect(d.confidence, lessThan(30));
      });

      test('sharp turn → sharpTurn', () {
        expect(runScenario(Scenario.sharpTurn, seed: seed)!.eventClass, EventClass.sharpTurn);
      });

      test('phone drop → rejected by the free-fall check', () {
        final d = runScenario(Scenario.phoneDrop, seed: seed)!;
        expect(d.phoneDrop, isTrue);
        expect(d.eventClass, isNull);
        expect(d.features.freeFallFlag, isTrue);
      });

      test('severe impact → severeAccident with high confidence', () {
        final d = runScenario(Scenario.severeImpact, seed: seed)!;
        expect(d.eventClass, EventClass.severeAccident);
        expect(d.confidence, greaterThanOrEqualTo(70));
        expect(d.features.deltaV, greaterThan(40));
        expect(d.features.saturationDuration, greaterThan(0));
      });

      test('rollover → possibleRollover', () {
        final d = runScenario(Scenario.rollover, seed: seed)!;
        expect(d.eventClass, EventClass.possibleRollover);
        expect(d.rotationDeg, greaterThan(90));
        expect(d.confidence, greaterThanOrEqualTo(70));
      });
    });
  }
}
