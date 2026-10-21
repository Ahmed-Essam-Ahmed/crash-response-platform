// Free push channel for the demo: a Telegram bot.
//
// Twilio trials are not available in Egypt, so the "automatic, no tap needed"
// alert goes through the Telegram Bot API instead: every contact who opened the
// SafeDrive bot and pressed Start receives a push notification with the
// emergency message AND a live map pin of the accident location — on iPhone or
// Android, from an emulator without a SIM.
//
// Recipients = chat IDs from secrets.json (TELEGRAM_CHAT_IDS, comma separated)
// plus anyone who messaged the bot in the last 24 h (getUpdates).
//
// SECURITY (documented limitation): the bot token sits in the app binary —
// fine for the sideloaded demo; production moves sending into a Cloud Function.

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../domain/domain.dart';
import 'alert_dispatcher.dart';

class TelegramConfig {
  const TelegramConfig({required this.botToken, this.chatIds = const []});

  static final fromEnvironment = TelegramConfig(
    botToken: const String.fromEnvironment('TELEGRAM_BOT_TOKEN'),
    chatIds: const String.fromEnvironment('TELEGRAM_CHAT_IDS')
        .split(',')
        .map((s) => s.trim())
        .where((s) => RegExp(r'^-?\d+$').hasMatch(s))
        .toList(),
  );

  final String botToken;
  final List<String> chatIds;

  bool get isConfigured => RegExp(r'^\d+:[\w-]{30,}$').hasMatch(botToken);
}

class TelegramAlertDispatcher implements AlertDispatcher {
  TelegramAlertDispatcher(this.config, {http.Client? client, this.locationOf})
      : _client = client ?? http.Client();

  final TelegramConfig config;
  final http.Client _client;

  /// Where the accident is (to send a map pin). Optional.
  final GeoLocation? Function()? locationOf;

  @override
  bool get isAutomatic => true;

  Uri _api(String method) => Uri.https('api.telegram.org', '/bot${config.botToken}/$method');

  Future<Map<String, dynamic>?> _call(String method, Map<String, dynamic> body) async {
    try {
      final r = await _client
          .post(_api(method),
              headers: {'Content-Type': 'application/json'}, body: jsonEncode(body))
          .timeout(const Duration(seconds: 12));
      final j = jsonDecode(r.body) as Map<String, dynamic>;
      return j;
    } catch (_) {
      return null;
    }
  }

  /// Configured IDs + everyone who wrote to the bot recently.
  Future<Set<String>> recipients() async {
    final ids = {...config.chatIds};
    final j = await _call('getUpdates', {'limit': 100});
    final updates = (j?['result'] as List?) ?? const [];
    for (final u in updates) {
      final msg = (u as Map)['message'] ?? u['my_chat_member'];
      final chat = (msg is Map) ? msg['chat'] : null;
      final id = (chat is Map) ? chat['id'] : null;
      if (id != null) ids.add('$id');
    }
    return ids;
  }

  /// Parses "...?q=lat,lng" from the message's Google Maps link.
  static (double, double)? _latLngFromMessage(String message) {
    final m = RegExp(r'\?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)').firstMatch(message);
    if (m == null) return null;
    return (double.parse(m.group(1)!), double.parse(m.group(2)!));
  }

  @override
  Future<DispatchReport> notifyContacts(List<EmergencyContact> contacts, String message) async {
    final to = await recipients();
    if (to.isEmpty) {
      return const DispatchReport(
        push: ChannelStatus.failed,
        smsGateway: ChannelStatus.notConfigured,
        composer: ChannelStatus.needsUserTap,
        details: ['Telegram: nobody has pressed Start in the SafeDrive bot yet'],
      );
    }
    final loc = locationOf?.call();
    final ll = loc != null ? (loc.latitude, loc.longitude) : _latLngFromMessage(message);

    final details = <String>[];
    var ok = 0;
    for (final chatId in to) {
      final r = await _call('sendMessage', {
        'chat_id': chatId,
        'text': '🚨 $message',
        'disable_web_page_preview': true,
      });
      if (r?['ok'] == true) {
        ok++;
        final name = ((r!['result'] as Map)['chat'] as Map)['first_name'] ?? chatId;
        details.add('Telegram alert sent to $name');
        if (ll != null) {
          await _call('sendLocation', {'chat_id': chatId, 'latitude': ll.$1, 'longitude': ll.$2});
        }
      } else {
        details.add('Telegram to $chatId failed: ${r?['description'] ?? 'no connection'}');
      }
    }
    return DispatchReport(
      push: ok > 0 ? ChannelStatus.sent : ChannelStatus.failed,
      smsGateway: ChannelStatus.notConfigured,
      composer: ChannelStatus.needsUserTap,
      details: details,
    );
  }
}
