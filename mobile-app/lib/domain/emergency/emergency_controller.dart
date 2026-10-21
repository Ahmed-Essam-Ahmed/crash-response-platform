// CONTRACT FILE — EmergencyController API (file 02 §6.6).
// Hazem implements it in lib/application/emergency/.

import '../detection/detection.dart';
import '../severity/severity.dart';

abstract interface class EmergencyController {
  /// Starts the full-screen countdown (default 20 s, configurable).
  Future<void> raiseSevereEvent(AccidentEventResult event, Severity severity);

  /// Driver pressed I'M OK. Event is saved as cancelled.
  Future<void> cancel();

  /// Countdown expired: location → persist → notify contacts.
  Future<void> dispatch();
}
