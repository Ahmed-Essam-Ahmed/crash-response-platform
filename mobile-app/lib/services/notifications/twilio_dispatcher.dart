// SMS gateway channel (file 02 §9 "Cloud Function → SMS gateway") — demo form.
//
// Twilio sends a REAL SMS (with the Google Maps link) to every emergency
// contact and places a REAL voice call to contact #1, so the alert reaches a
// real phone even from an emulator without a SIM.
//
// SECURITY (documented limitation): credentials come from
// `--dart-define-from-file=twilio.json` and are NOT in the source, but they are
// still inside the app binary. Acceptable for the sideloaded graduation demo;
// production moves this call into a Firebase Cloud Function so the token never
// leaves the server (step 9 / backend).

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../domain/domain.dart';
import 'alert_dispatcher.dart';

class TwilioConfig {
  const TwilioConfig({required this.accountSid, required this.authToken, required this.fromNumber});

  /// Read from `--dart-define-from-file=twilio.json`.
  static const fromEnvironment = TwilioConfig(
    accountSid: String.fromEnvironment('TWILIO_ACCOUNT_SID'),
    authToken: String.fromEnvironment('TWILIO_AUTH_TOKEN'),
    fromNumber: String.fromEnvironment('TWILIO_FROM_NUMBER'),
  );

  final String accountSid;
  final String authToken;
  final String fromNumber;

  bool get isConfigured =>
      accountSid.startsWith('AC') && authToken.length >= 20 && fromNumber.startsWith('+');
}

class TwilioAlertDispatcher implements AlertDispatcher {
  TwilioAlertDispatcher(this.config, {http.Client? client, this.callFirstContact = true})
      : _client = client ?? http.Client();

  final TwilioConfig config;
  final http.Client _client;
  final bool callFirstContact;

  @override
  bool get isAutomatic => true;

  /// Egyptian local numbers (01xxxxxxxxx) → E.164 (+201xxxxxxxxx).
  static String toE164(String phone, {String countryCode = '20'}) {
    final p = phone.replaceAll(RegExp(r'[\s\-()]'), '');
    if (p.startsWith('+')) return p;
    if (p.startsWith('00')) return '+${p.substring(2)}';
    if (p.startsWith(countryCode) && p.length > 11) return '+$p';
    if (p.startsWith('0')) return '+$countryCode${p.substring(1)}';
    return '+$countryCode$p';
  }

  static String _xml(String s) => s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

  Uri _api(String resource) =>
      Uri.https('api.twilio.com', '/2010-04-01/Accounts/${config.accountSid}/$resource.json');

  Map<String, String> get _headers => {
        'Authorization':
            'Basic ${base64Encode(utf8.encode('${config.accountSid}:${config.authToken}'))}',
      };

  Future<String?> _post(String resource, Map<String, String> form) async {
    try {
      final r = await _client
          .post(_api(resource), headers: _headers, body: form)
          .timeout(const Duration(seconds: 12));
      if (r.statusCode >= 200 && r.statusCode < 300) return null;
      try {
        final j = jsonDecode(r.body) as Map<String, dynamic>;
        return '${j['message'] ?? 'HTTP ${r.statusCode}'}';
      } catch (_) {
        return 'HTTP ${r.statusCode}';
      }
    } catch (e) {
      return 'No connection to Twilio ($e)';
    }
  }

  @override
  Future<DispatchReport> notifyContacts(List<EmergencyContact> contacts, String message) async {
    if (contacts.isEmpty) {
      return const DispatchReport(
        push: ChannelStatus.notConfigured,
        smsGateway: ChannelStatus.failed,
        composer: ChannelStatus.failed,
        details: ['No emergency contacts configured'],
      );
    }
    final sorted = [...contacts]..sort((a, b) => a.priority.compareTo(b.priority));
    final details = <String>[];
    var smsOk = 0;

    // SMS to everyone, in priority order.
    for (final c in sorted) {
      final err = await _post('Messages', {
        'To': toE164(c.phone),
        'From': config.fromNumber,
        'Body': message,
      });
      if (err == null) {
        smsOk++;
        details.add('SMS sent to ${c.name}');
      } else {
        details.add('SMS to ${c.name} failed: $err');
      }
    }

    // Voice call to the first contact.
    var callOk = false;
    if (callFirstContact) {
      final first = sorted.first;
      final say = 'SafeDrive emergency alert. A possible severe vehicle accident has been '
          'detected. The location has been sent to you by text message. '
          'Please contact the driver immediately.';
      final err = await _post('Calls', {
        'To': toE164(first.phone),
        'From': config.fromNumber,
        'Twiml': '<Response><Say voice="alice" loop="2">${_xml(say)}</Say></Response>',
      });
      callOk = err == null;
      details.add(callOk ? 'Calling ${first.name}…' : 'Call to ${first.name} failed: $err');
    }

    return DispatchReport(
      push: ChannelStatus.notConfigured,
      smsGateway: smsOk > 0 || callOk ? ChannelStatus.sent : ChannelStatus.failed,
      composer: ChannelStatus.needsUserTap,
      details: details,
    );
  }
}
