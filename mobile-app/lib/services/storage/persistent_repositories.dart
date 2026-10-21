// Settings and emergency contacts that survive app restarts.
//
// • Settings → SQLite key/value table.
// • Emergency contacts → OS secure storage (Android Keystore / iOS Keychain,
//   encrypted at rest) — the brief asks to protect contact information
//   (file 01 "Security: protection of emergency contact information").

import 'dart:async';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../domain/domain.dart';
import 'codec.dart';
import 'contacts_repository.dart';
import 'database.dart';
import 'settings_repository.dart';

abstract interface class Loadable {
  Future<void> load();
}

class SqlSettingsRepository implements SettingsRepository, Loadable {
  SqlSettingsRepository(this._db);

  final SafeDriveDb _db;
  final _controller = StreamController<AppSettings>.broadcast();
  AppSettings _value = const AppSettings();

  @override
  AppSettings get current => _value;

  @override
  Future<void> load() async {
    final r = await _db.query("SELECT value FROM kv WHERE key = 'settings'");
    _value = Codec.settingsFromJson(r.isEmpty ? null : r.first['value'] as String?);
    _controller.add(_value);
  }

  @override
  Stream<AppSettings> watch() async* {
    yield _value;
    yield* _controller.stream;
  }

  @override
  Future<void> save(AppSettings settings) async {
    _value = settings;
    _controller.add(settings);
    await _db.exec(
      "INSERT OR REPLACE INTO kv (key, value) VALUES ('settings', ?)",
      [Codec.settingsToJson(settings)],
    );
  }

  void dispose() => _controller.close();
}

/// Small wrapper so tests can swap the platform plugin.
abstract interface class SecretStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class PlatformSecretStore implements SecretStore {
  static const _s = FlutterSecureStorage();

  @override
  Future<String?> read(String key) => _s.read(key: key);

  @override
  Future<void> write(String key, String value) => _s.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _s.delete(key: key);
}

class SecureContactsRepository implements ContactsRepository, Loadable {
  SecureContactsRepository(this._store);

  static const _key = 'emergency_contacts';
  final SecretStore _store;
  final _controller = StreamController<List<EmergencyContact>>.broadcast();
  List<EmergencyContact> _items = const [];

  @override
  List<EmergencyContact> get current => _items;

  @override
  Future<void> load() async {
    try {
      _items = List.unmodifiable(Codec.contactsFromJson(await _store.read(_key)));
    } catch (_) {
      _items = const [];
    }
    _controller.add(_items);
  }

  @override
  Stream<List<EmergencyContact>> watch() async* {
    yield _items;
    yield* _controller.stream;
  }

  @override
  Future<void> saveAll(List<EmergencyContact> contacts) async {
    _items = List.unmodifiable(contacts);
    _controller.add(_items);
    try {
      await _store.write(_key, Codec.contactsToJson(contacts));
    } catch (_) {
      // Secure storage unavailable → contacts still work for this session.
    }
  }

  void dispose() => _controller.close();
}
