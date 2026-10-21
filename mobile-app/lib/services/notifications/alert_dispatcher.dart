// Emergency notification channels (file 02 §9, task steps 9–10).
//
//   1. FCM push to contacts who have the app      → needs Firebase (step 3)
//   2. Cloud Function → SMS gateway (robust path) → needs Firebase (step 3)
//   3. On-device fallback: pre-filled SMS composer / dialer → works now
//
// Platform reality (documented honestly): iOS never allows silent SMS, and
// Google Play restricts SEND_SMS, so channel 3 always needs one tap from the
// driver or a bystander.

import 'package:url_launcher/url_launcher.dart';

import '../../domain/domain.dart';

enum ChannelStatus { sent, notConfigured, failed, needsUserTap }

class DispatchReport {
  const DispatchReport({
    required this.push,
    required this.smsGateway,
    required this.composer,
    this.details = const [],
  });

  final ChannelStatus push;
  final ChannelStatus smsGateway;
  final ChannelStatus composer;

  /// Per-contact outcome lines for the Emergency Active screen.
  final List<String> details;

  bool get anyAutomaticSent =>
      push == ChannelStatus.sent || smsGateway == ChannelStatus.sent;
}

abstract interface class AlertDispatcher {
  /// true = can reach contacts without anyone tapping (push / SMS gateway).
  bool get isAutomatic;

  Future<DispatchReport> notifyContacts(
    List<EmergencyContact> contacts,
    String message,
  );
}

/// Until Firebase exists: automatic channels report "not configured" and the
/// UI offers the one-tap SMS composer.
class LocalOnlyAlertDispatcher implements AlertDispatcher {
  @override
  bool get isAutomatic => false;

  @override
  Future<DispatchReport> notifyContacts(
    List<EmergencyContact> contacts,
    String message,
  ) async =>
      DispatchReport(
        push: ChannelStatus.notConfigured,
        smsGateway: ChannelStatus.notConfigured,
        composer: contacts.isEmpty ? ChannelStatus.failed : ChannelStatus.needsUserTap,
      );
}

/// Builds the emergency SMS text (file 02 §9 template).
class EmergencyMessage {
  static String build({
    required Severity? severity,
    required double lastSpeedKmh,
    required GeoLocation? location,
  }) {
    final level = (severity?.level ?? SeverityLevel.high).name.toUpperCase();
    final loc = location == null ? 'Unavailable' : location.mapsUrl;
    return 'SafeDrive Emergency Alert\n'
        'A possible severe vehicle accident has been detected.\n'
        'Severity: $level\n'
        'Last known speed: ${lastSpeedKmh.round()} km/h\n'
        'Location: $loc\n'
        'Please contact the driver immediately.';
  }
}

/// One-tap actions on the Emergency Active screen.
class PhoneActions {
  /// Egypt ambulance. Change per country.
  static const emergencyNumber = '123';

  static Future<bool> call(String number) =>
      _open(Uri(scheme: 'tel', path: number));

  /// Opens the SMS app pre-filled. Several recipients separated by ','.
  static Future<bool> sms(List<String> numbers, String body) => _open(
        Uri(
          scheme: 'sms',
          path: numbers.join(','),
          queryParameters: {'body': body},
        ),
      );

  static Future<bool> openMap(GeoLocation loc) => _open(Uri.parse(loc.mapsUrl));

  static Future<bool> _open(Uri uri) async {
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  }
}
