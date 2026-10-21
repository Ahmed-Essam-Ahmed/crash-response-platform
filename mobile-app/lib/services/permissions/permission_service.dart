// Permission flows on Android AND iOS (task step 5).
//
// Platform facts (documented):
//  • Location "Always" must be requested AFTER "While using" on Android 10+
//    and iOS; the OS shows its own second prompt / settings page.
//  • Notifications need a runtime prompt on Android 13+ and iOS.
//  • iOS motion data (Core Motion) has its own prompt; Android needs no
//    permission for accelerometer/gyroscope, but needs ACTIVITY_RECOGNITION for
//    automatic driving detection (Activity Recognition API).

import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';

enum AppPermission { location, backgroundLocation, notifications, motion }

enum PermState { granted, limited, denied, permanentlyDenied, notApplicable }

abstract interface class PermissionService {
  Future<PermState> status(AppPermission p);
  Future<PermState> request(AppPermission p);
  Future<bool> openSettings();
}

class PlatformPermissionService implements PermissionService {
  static Permission _map(AppPermission p) => switch (p) {
        AppPermission.location => Permission.locationWhenInUse,
        AppPermission.backgroundLocation => Permission.locationAlways,
        AppPermission.notifications => Permission.notification,
        // iOS: Core Motion prompt. Android: Activity Recognition (driving
        // detection) — accelerometer/gyroscope themselves need no permission.
        AppPermission.motion => defaultTargetPlatform == TargetPlatform.iOS
            ? Permission.sensors
            : Permission.activityRecognition,
      };

  static PermState _state(PermissionStatus s) {
    if (s.isGranted) return PermState.granted;
    if (s.isLimited || s.isProvisional) return PermState.limited;
    if (s.isPermanentlyDenied || s.isRestricted) return PermState.permanentlyDenied;
    return PermState.denied;
  }

  @override
  Future<PermState> status(AppPermission p) async {
    try {
      return _state(await _map(p).status);
    } catch (_) {
      return PermState.notApplicable; // platform without this permission
    }
  }

  @override
  Future<PermState> request(AppPermission p) async {
    try {
      // "Always" can only be asked once "While using" is granted.
      if (p == AppPermission.backgroundLocation &&
          !(await Permission.locationWhenInUse.status).isGranted) {
        final first = await Permission.locationWhenInUse.request();
        if (!first.isGranted) return _state(first);
      }
      return _state(await _map(p).request());
    } catch (_) {
      return PermState.notApplicable;
    }
  }

  @override
  Future<bool> openSettings() => openAppSettings();
}

/// Tests / platforms without permissions.
class AllowAllPermissionService implements PermissionService {
  @override
  Future<PermState> status(AppPermission p) async => PermState.granted;
  @override
  Future<PermState> request(AppPermission p) async => PermState.granted;
  @override
  Future<bool> openSettings() async => true;
}
