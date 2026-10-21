import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:safedrive/services/notifications/alert_dispatcher.dart';
import 'package:safedrive/services/notifications/telegram_dispatcher.dart';

void main() {
  const token = '123456789:AAAbbbCCCdddEEEfffGGGhhhIIIjjjKKK';

  test('config validation', () {
    expect(const TelegramConfig(botToken: token).isConfigured, isTrue);
    expect(const TelegramConfig(botToken: 'PASTE').isConfigured, isFalse);
  });

  test('sends the alert + a map pin to everyone who started the bot', () async {
    final calls = <String, List<Map<String, dynamic>>>{};
    final client = MockClient((r) async {
      final method = r.url.pathSegments.last;
      final body = r.body.isEmpty ? <String, dynamic>{} : jsonDecode(r.body) as Map<String, dynamic>;
      (calls[method] ??= []).add(body);
      return switch (method) {
        'getUpdates' => http.Response(
            jsonEncode({
              'ok': true,
              'result': [
                {
                  'update_id': 1,
                  'message': {
                    'chat': {'id': 555, 'first_name': 'Hazem'},
                    'text': '/start'
                  }
                }
              ]
            }),
            200),
        'sendMessage' => http.Response(
            jsonEncode({
              'ok': true,
              'result': {
                'chat': {'id': 555, 'first_name': 'Hazem'}
              }
            }),
            200),
        _ => http.Response('{"ok":true,"result":{}}', 200),
      };
    });

    final report = await TelegramAlertDispatcher(
      const TelegramConfig(botToken: token, chatIds: ['777']),
      client: client,
    ).notifyContacts(const [], 'SafeDrive Emergency Alert\nLocation: https://maps.google.com/?q=30.044400,31.235700');

    expect(report.push, ChannelStatus.sent);
    expect(calls['sendMessage']!.map((b) => '${b['chat_id']}').toSet(), {'555', '777'});
    expect(calls['sendLocation']!.first['latitude'], closeTo(30.0444, 1e-6));
    expect(report.details, contains('Telegram alert sent to Hazem'));
  });

  test('nobody subscribed → clear failure message', () async {
    final client = MockClient((r) async => http.Response('{"ok":true,"result":[]}', 200));
    final report = await TelegramAlertDispatcher(const TelegramConfig(botToken: token), client: client)
        .notifyContacts(const [], 'x');
    expect(report.push, ChannelStatus.failed);
    expect(report.details.single, contains('Start'));
  });
}
