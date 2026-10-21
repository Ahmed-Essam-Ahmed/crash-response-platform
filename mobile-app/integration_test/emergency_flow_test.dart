// End-to-end test on the emulator / a real phone (task step 16):
// replayed severe impact → countdown → dispatch → contact alerted with a map
// link; and the cancel path (I'M OK). Run with e2e.bat.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:safedrive/application/app_services.dart';
import 'package:safedrive/domain/domain.dart';
import 'package:safedrive/presentation/app.dart';
import 'package:safedrive/services/permissions/permission_service.dart';

import '../test/fakes.dart';

AppServices? _services;

/// Waits in REAL time (on a device the app's timers run in real time).
Future<void> waitFor(WidgetTester t, Finder f, {int seconds = 20}) async {
  for (var i = 0; i < seconds * 10; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 100));
    await t.pump();
    if (f.evaluate().isNotEmpty) return;
  }
  final engine = _services?.monitor.currentStatus;
  throw TestFailure('Timed out waiting for $f — engine: ${engine?.phase} "${engine?.headline}"');
}

/// Lets page transitions finish (two routes = two Scrollables mid-animation).
Future<void> settle(WidgetTester t) async {
  for (var i = 0; i < 10; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 100));
    await t.pump();
  }
}

/// Scrolls the top-most list until [f] is on screen.
Future<void> scrollTo(WidgetTester t, Finder f) async {
  await settle(t);
  await t.scrollUntilVisible(f, 200, scrollable: find.byType(Scrollable).last);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('severe impact → dispatch, then rollover → I\'M OK', (t) async {
    final alerts = RecordingDispatcher();
    final services = AppServices.mock(
      location: FakeLocationProvider(
        const GeoLocation(latitude: 30.0444, longitude: 31.2357, speedKmh: 0),
      ),
      dispatcher: alerts,
      permissions: AllowAllPermissionService(),
    );
    _services = services;
    await t.pumpWidget(SafeDriveApp(services: services));

    // Onboarding → permissions → home
    await waitFor(t, find.text('Skip'));
    await t.tap(find.text('Skip'));
    await waitFor(t, find.text('Continue'));
    await settle(t);
    await t.tap(find.text('Continue'));
    await waitFor(t, find.text('System status'));

    // Add an emergency contact
    final contactsBtn = find.text('Emergency contacts').last;
    await scrollTo(t, contactsBtn);
    await t.tap(contactsBtn);
    await waitFor(t, find.text('Add contact'));
    await settle(t);
    await t.tap(find.text('Add contact'));
    await waitFor(t, find.byType(TextField));
    await t.enterText(find.byType(TextField).at(0), 'Mom');
    await t.enterText(find.byType(TextField).at(1), '01012345678');
    await t.tap(find.text('Save'));
    await waitFor(t, find.text('Mom'));
    await settle(t);
    await t.pageBack();
    await waitFor(t, find.text('1 CONFIGURED'));

    // ---------- Dispatch path
    final testModeBtn = find.text('Test mode');
    await scrollTo(t, testModeBtn);
    await t.tap(testModeBtn);
    await waitFor(t, find.text('Severe Impact'));
    await settle(t);
    await t.tap(find.text('Severe Impact'));
    await settle(t);
    await t.tap(find.text('START SIMULATION'));
    await waitFor(t, find.text('Replaying sensor data…'), seconds: 5);
    await waitFor(t, find.text("I'M OK"), seconds: 40); // engine decided → countdown
    expect(find.text('POSSIBLE SEVERE ACCIDENT'), findsOneWidget);
    await t.tap(find.text('I need help — alert now'));
    await waitFor(t, find.text('Emergency active'));

    expect(alerts.calls, hasLength(1));
    final (to, message) = alerts.calls.single;
    expect(to.single.name, 'Mom');
    expect(message, contains('https://maps.google.com/?q=30.044400,31.235700'));

    await scrollTo(t, find.text("I'm safe now — close"));
    await t.tap(find.text("I'm safe now — close"));
    await waitFor(t, find.text('START SIMULATION'));
    await settle(t);

    // ---------- Cancel path
    await t.tap(find.text('Rollover'));
    await settle(t);
    await t.tap(find.text('START SIMULATION'));
    await waitFor(t, find.text("I'M OK"), seconds: 40);
    await t.tap(find.text("I'M OK"));
    await waitFor(t, find.textContaining('glad you are OK'));
    expect(alerts.calls, hasLength(1)); // nothing new sent

    final history = await services.events.history();
    expect(history.map((e) => e.status), containsAll([AccidentStatus.dispatched, AccidentStatus.cancelled]));

    // Let the replay, the alarm player and page transitions wind down before
    // the test tears the app down.
    for (var i = 0; i < 30; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 100));
      await t.pump();
    }
  });
}
