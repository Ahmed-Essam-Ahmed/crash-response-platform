import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safedrive/application/app_services.dart';
import 'package:safedrive/presentation/app.dart';
import 'package:safedrive/services/permissions/permission_service.dart';

import 'fakes.dart';

void main() {
  testWidgets('Splash shows the brand, then opens onboarding', (tester) async {
    await tester.pumpWidget(SafeDriveApp(services: AppServices.mock(
        location: FakeLocationProvider(), permissions: AllowAllPermissionService())));

    expect(find.text('SafeDrive'), findsOneWidget);
    expect(find.text('Intelligent Vehicle Safety System'), findsOneWidget);

    // AppServices.init() takes ~1.2 s in mock mode.
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('What SafeDrive does'), findsOneWidget);
  });

  testWidgets('Skipping onboarding lands on the dashboard', (tester) async {
    await tester.pumpWidget(SafeDriveApp(services: AppServices.mock(
        location: FakeLocationProvider(), permissions: AllowAllPermissionService())));
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 500));

    await tester.tap(find.text('Skip'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    // Permissions screen (all granted in tests) → Continue.
    expect(find.text('Permissions'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 100));
    await tester.scrollUntilVisible(find.text('Continue'), 200);
    await tester.tap(find.text('Continue'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('System status'), findsOneWidget);
    expect(find.text('SETUP NEEDED'), findsOneWidget); // no contacts yet
    expect(find.byType(Switch), findsOneWidget);
  });
}
