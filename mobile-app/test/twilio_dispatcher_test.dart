import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:safedrive/domain/domain.dart';
import 'package:safedrive/services/notifications/alert_dispatcher.dart';
import 'package:safedrive/services/notifications/twilio_dispatcher.dart';

void main() {
  const cfg = TwilioConfig(
    accountSid: 'AC00000000000000000000000000000000',
    authToken: '0123456789abcdef0123456789abcdef',
    fromNumber: '+15550001111',
  );
  const contacts = [
    EmergencyContact(id: '2', name: 'Dad', phone: '01122223333', priority: 2),
    EmergencyContact(id: '1', name: 'Mom', phone: '01012345678', priority: 1),
  ];

  test('Egyptian numbers become E.164', () {
    expect(TwilioAlertDispatcher.toE164('01012345678'), '+201012345678');
    expect(TwilioAlertDispatcher.toE164('+201012345678'), '+201012345678');
    expect(TwilioAlertDispatcher.toE164('00201012345678'), '+201012345678');
    expect(TwilioAlertDispatcher.toE164('201012345678'), '+201012345678');
  });

  test('sends SMS to every contact and calls contact #1', () async {
    final requests = <http.Request>[];
    final client = MockClient((r) async {
      requests.add(r);
      return http.Response('{"sid":"SM1"}', 201);
    });
    final report = await TwilioAlertDispatcher(cfg, client: client)
        .notifyContacts(contacts, 'SafeDrive Emergency Alert https://maps.google.com/?q=1,2');

    expect(report.smsGateway, ChannelStatus.sent);
    expect(requests.where((r) => r.url.path.endsWith('Messages.json')).length, 2);
    final call = requests.singleWhere((r) => r.url.path.endsWith('Calls.json'));
    expect(call.bodyFields['To'], '+201012345678'); // Mom = priority 1
    expect(call.bodyFields['Twiml'], contains('<Say'));
    expect(requests.first.bodyFields['To'], '+201012345678'); // priority order
    expect(requests.first.bodyFields['Body'], contains('maps.google.com'));
    expect(requests.first.headers['Authorization'],
        'Basic ${base64Encode(utf8.encode('${cfg.accountSid}:${cfg.authToken}'))}');
  });

  test('Twilio errors are reported, not thrown', () async {
    final client = MockClient(
        (r) async => http.Response('{"message":"The number is unverified."}', 400));
    final report =
        await TwilioAlertDispatcher(cfg, client: client).notifyContacts(contacts, 'x');
    expect(report.smsGateway, ChannelStatus.failed);
    expect(report.details.first, contains('unverified'));
  });

  test('config check', () {
    expect(cfg.isConfigured, isTrue);
    expect(const TwilioConfig(accountSid: '', authToken: '', fromNumber: '').isConfigured, isFalse);
  });
}
