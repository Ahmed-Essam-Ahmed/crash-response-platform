// Test Mode port (task step 13): replays a recorded scenario through the
// REAL detection engine; its output then arrives on DetectionEngine.events
// exactly like a live event.

import '../detection/scenario_generator.dart';

export '../detection/scenario_generator.dart' show Scenario;

abstract interface class ScenarioRunner {
  List<Scenario> get scenarios;
  Future<void> run(Scenario scenario);
}
