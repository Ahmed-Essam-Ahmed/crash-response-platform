import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../application/app_services.dart';
import '../application/emergency/emergency_cubit.dart';
import 'contacts/contacts_cubit.dart';
import 'contacts/contacts_screen.dart';
import 'driving/driving_cubit.dart';
import 'driving/driving_screen.dart';
import 'emergency/countdown_screen.dart';
import 'emergency/emergency_active_screen.dart';
import 'history/accident_detail_screen.dart';
import 'history/history_screen.dart';
import 'home/home_screen.dart';
import 'onboarding/onboarding_screen.dart';
import 'permissions/permissions_screen.dart';
import 'privacy/privacy_screen.dart';
import 'settings/settings_cubit.dart';
import 'settings/settings_screen.dart';
import 'splash/splash_screen.dart';
import 'test_mode/test_mode_screen.dart';
import 'theme.dart';

class Routes {
  static const splash = '/';
  static const onboarding = '/onboarding';
  static const home = '/home';
  static const driving = '/driving';
  static const contacts = '/contacts';
  static const settings = '/settings';
  static const countdown = '/emergency/countdown';
  static const emergencyActive = '/emergency/active';
  static const history = '/history';
  static const detail = '/history/detail';
  static const testMode = '/test-mode';
  static const privacy = '/privacy';
  static const permissions = '/permissions';
  static const permissionsFirstRun = '/permissions/first-run';
}

class SafeDriveApp extends StatefulWidget {
  const SafeDriveApp({super.key, required this.services});

  final AppServices services;

  @override
  State<SafeDriveApp> createState() => _SafeDriveAppState();
}

class _SafeDriveAppState extends State<SafeDriveApp> {
  final _navKey = GlobalKey<NavigatorState>();

  @override
  void dispose() {
    widget.services.dispose();
    super.dispose();
  }

  /// The emergency flow can start from ANY screen, so navigation for it lives
  /// here, above every route.
  void _onEmergency(BuildContext context, EmergencyState s) {
    final nav = _navKey.currentState;
    if (nav == null) return;
    switch (s) {
      case EmergencyCountdown():
        nav.pushNamed(Routes.countdown);
      case EmergencyDispatching():
        nav.pushReplacementNamed(Routes.emergencyActive);
      case EmergencyCancelled():
        nav.pop();
        ScaffoldMessenger.of(_navKey.currentContext!).showSnackBar(
          const SnackBar(content: Text('Cancelled — glad you are OK. Event saved to history.')),
        );
      case EmergencyIdle():
        // Leaving the Emergency Active screen.
        nav.popUntil((r) => r.settings.name != Routes.emergencyActive);
      case EmergencyActive():
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.services;
    return RepositoryProvider<AppServices>.value(
      value: s,
      child: MultiBlocProvider(
        providers: [
          BlocProvider(create: (_) => DrivingCubit(s.drivingDetector)),
          BlocProvider(create: (_) => SettingsCubit(s.settings)),
          BlocProvider(create: (_) => ContactsCubit(s.contacts)),
          BlocProvider(
            lazy: false,
            create: (_) => EmergencyCubit(
              engine: s.detectionEngine,
              severityModel: s.severityModel,
              events: s.events,
              contacts: s.contacts,
              settings: s.settings,
              location: s.location,
              dispatcher: s.dispatcher,
              driving: s.drivingDetector,
            ),
          ),
        ],
        child: BlocListener<EmergencyCubit, EmergencyState>(
          listenWhen: (a, b) => a.runtimeType != b.runtimeType,
          listener: _onEmergency,
          child: MaterialApp(
            navigatorKey: _navKey,
            title: 'SafeDrive',
            debugShowCheckedModeBanner: false,
            theme: buildTheme(Brightness.light),
            darkTheme: buildTheme(Brightness.dark),
            initialRoute: Routes.splash,
            routes: {
              Routes.splash: (_) => const SplashScreen(),
              Routes.onboarding: (_) => const OnboardingScreen(),
              Routes.home: (_) => const HomeScreen(),
              Routes.driving: (_) => const DrivingScreen(),
              Routes.contacts: (_) => const ContactsScreen(),
              Routes.settings: (_) => const SettingsScreen(),
              Routes.countdown: (_) => const CountdownScreen(),
              Routes.emergencyActive: (_) => const EmergencyActiveScreen(),
              Routes.history: (_) => const HistoryScreen(),
              Routes.testMode: (_) => const TestModeScreen(),
              Routes.privacy: (_) => const PrivacyScreen(),
              Routes.permissions: (_) => const PermissionsScreen(),
              Routes.permissionsFirstRun: (_) => const PermissionsScreen(fromOnboarding: true),
            },
            onGenerateRoute: (settings) {
              if (settings.name == Routes.detail) {
                return MaterialPageRoute(
                  settings: settings,
                  builder: (_) => AccidentDetailScreen(eventId: settings.arguments! as String),
                );
              }
              return null;
            },
          ),
        ),
      ),
    );
  }
}
