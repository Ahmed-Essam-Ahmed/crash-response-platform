// CONTRACT FILE — the 7 event classes (file 02 §1 / §4).

enum EventClass {
  normalDriving('Normal driving'),
  hardBraking('Hard braking'),
  pothole('Pothole / road impact'),
  sharpTurn('Sharp turn'),
  possibleAccident('Possible accident'),
  severeAccident('Severe accident'),
  possibleRollover('Possible rollover');

  const EventClass(this.label);

  final String label;

  /// Classes that can lead to the emergency flow (still gated by severity).
  bool get isAccident =>
      this == possibleAccident ||
      this == severeAccident ||
      this == possibleRollover;
}
