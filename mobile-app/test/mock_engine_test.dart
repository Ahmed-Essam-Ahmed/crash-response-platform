import 'package:flutter_test/flutter_test.dart';
import 'package:safedrive/domain/domain.dart';
import 'package:safedrive/services/mocks/mock_detection_engine.dart';

void main() {
  test('mock engine emits a full AccidentEventResult per class', () async {
    final engine = MockDetectionEngine();
    final received = <AccidentEventResult>[];
    final sub = engine.events.listen(received.add);

    for (final c in EventClass.values) {
      engine.emit(c);
    }
    await Future<void>.delayed(Duration.zero);

    expect(received.length, EventClass.values.length);
    final severe = received.firstWhere((r) => r.eventClass == EventClass.severeAccident);
    expect(severe.confidence, greaterThan(90));
    expect(severe.features.deltaV, greaterThan(40));
    // ±10 s at 50 Hz
    expect(severe.sensorWindow.samples.length, 1001);
    expect(severe.location?.mapsUrl, startsWith('https://maps.google.com/?q='));

    await sub.cancel();
    engine.dispose();
  });
}
