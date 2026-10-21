// Store-and-forward for emergency alerts (Definition of Done: "offline-queued
// if no network, synced after").
//
// If the automatic channel cannot deliver (no internet at the crash site), the
// alert is written to the SQLite `outbox` and retried in the background until
// it goes through. The on-screen call / SMS buttons still work meanwhile.

import 'dart:async';
import 'dart:convert';

import '../../domain/domain.dart';
import '../storage/codec.dart';
import '../storage/database.dart';
import 'alert_dispatcher.dart';

class QueuedAlertDispatcher implements AlertDispatcher {
  QueuedAlertDispatcher(this.inner, this._db);

  final AlertDispatcher inner;
  final SafeDriveDb _db;

  @override
  bool get isAutomatic => inner.isAutomatic;

  @override
  Future<DispatchReport> notifyContacts(List<EmergencyContact> contacts, String message) async {
    final report = await inner.notifyContacts(contacts, message);
    if (!inner.isAutomatic || report.anyAutomaticSent || contacts.isEmpty) return report;
    await _db.exec(
      'INSERT INTO outbox (kind, payload, created, attempts, last_error) VALUES (?, ?, ?, 1, ?)',
      [
        'alert',
        jsonEncode({'contacts': Codec.contactsToJson(contacts), 'message': message}),
        DateTime.now().millisecondsSinceEpoch,
        report.details.isEmpty ? null : report.details.last,
      ],
    );
    return DispatchReport(
      push: report.push,
      smsGateway: report.smsGateway,
      composer: report.composer,
      details: [
        ...report.details,
        'No connection — alert queued, it will be sent automatically when the network is back',
      ],
    );
  }

  Future<int> pending() async {
    final r = await _db.query("SELECT COUNT(*) AS n FROM outbox WHERE kind = 'alert'");
    return (r.first['n']! as num).toInt();
  }

  /// Retries every queued alert once. Returns how many went out.
  Future<int> flush() async {
    var sent = 0;
    for (final row in await _db.query("SELECT * FROM outbox WHERE kind = 'alert' ORDER BY id")) {
      final p = jsonDecode(row['payload']! as String) as Map<String, dynamic>;
      final contacts = Codec.contactsFromJson(p['contacts'] as String?);
      final r = await inner.notifyContacts(contacts, p['message'] as String);
      if (r.anyAutomaticSent) {
        await _db.exec('DELETE FROM outbox WHERE id = ?', [row['id']]);
        sent++;
      } else {
        await _db.exec(
          'UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?',
          [r.details.isEmpty ? null : r.details.last, row['id']],
        );
        break; // still offline
      }
    }
    return sent;
  }
}

/// Background loop: retries queued alerts and uploads unsynced events.
class SyncService {
  SyncService({required this.retry, this.interval = const Duration(seconds: 30)});

  final List<Future<int> Function()> retry;
  final Duration interval;
  Timer? _timer;
  bool _busy = false;

  void start() {
    _timer?.cancel();
    _timer = Timer.periodic(interval, (_) => runOnce());
    runOnce();
  }

  Future<void> runOnce() async {
    if (_busy) return;
    _busy = true;
    try {
      for (final f in retry) {
        try {
          await f();
        } catch (_) {}
      }
    } finally {
      _busy = false;
    }
  }

  void dispose() => _timer?.cancel();
}
