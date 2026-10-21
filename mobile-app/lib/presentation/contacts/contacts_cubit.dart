import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/domain.dart';
import '../../services/storage/contacts_repository.dart';

/// State = contacts sorted by priority (1 = notified first).
class ContactsCubit extends Cubit<List<EmergencyContact>> {
  ContactsCubit(this._repo) : super(_repo.current) {
    _sub = _repo.watch().listen(emit);
  }

  final ContactsRepository _repo;
  late final StreamSubscription<List<EmergencyContact>> _sub;

  /// The clock alone is not unique enough on Windows (coarse resolution),
  /// so ids also carry a running counter.
  static int _seq = 0;
  static String _newId() => '${DateTime.now().microsecondsSinceEpoch}-${_seq++}';

  /// Mutations read the repository (source of truth), not `state`, so two
  /// quick taps can't work on a stale list.
  List<EmergencyContact> get _items => _repo.current;

  bool get isFull => _items.length >= EmergencyContact.maxContacts;

  /// Accepts local (01xxxxxxxxx) or international (+20…) numbers.
  static final _phone = RegExp(r'^\+?[0-9]{7,15}$');

  static String normalizePhone(String raw) =>
      raw.replaceAll(RegExp(r'[\s\-()]'), '');

  /// Returns an error message, or null when valid.
  static String? validate(String name, String phone) {
    if (name.trim().isEmpty) return 'Enter a name';
    if (name.trim().length > 40) return 'Name is too long';
    if (!_phone.hasMatch(normalizePhone(phone))) {
      return 'Enter a valid phone number';
    }
    return null;
  }

  /// Returns an error message, or null on success.
  Future<String?> add(String name, String phone) async {
    if (isFull) {
      return 'You can add up to ${EmergencyContact.maxContacts} contacts';
    }
    final error = validate(name, phone);
    if (error != null) return error;
    final normalized = normalizePhone(phone);
    if (_items.any((c) => c.phone == normalized)) {
      return 'This number is already added';
    }
    final contact = EmergencyContact(
      id: _newId(),
      name: name.trim(),
      phone: normalized,
      priority: _items.length + 1,
    );
    await _repo.saveAll([..._items, contact]);
    return null;
  }

  /// Returns an error message, or null on success.
  Future<String?> edit(String id, String name, String phone) async {
    final error = validate(name, phone);
    if (error != null) return error;
    final normalized = normalizePhone(phone);
    if (_items.any((c) => c.id != id && c.phone == normalized)) {
      return 'This number is already added';
    }
    await _repo.saveAll([
      for (final c in _items)
        c.id == id ? c.copyWith(name: name.trim(), phone: normalized) : c,
    ]);
    return null;
  }

  Future<void> remove(String id) =>
      _repo.saveAll(_renumber(_items.where((c) => c.id != id).toList()));

  /// Drag-to-reorder (ReorderableListView index semantics).
  Future<void> reorder(int oldIndex, int newIndex) {
    final list = [..._items];
    if (newIndex > oldIndex) newIndex -= 1;
    final item = list.removeAt(oldIndex);
    list.insert(newIndex, item);
    return _repo.saveAll(_renumber(list));
  }

  static List<EmergencyContact> _renumber(List<EmergencyContact> list) => [
        for (var i = 0; i < list.length; i++) list[i].copyWith(priority: i + 1),
      ];

  @override
  Future<void> close() async {
    await _sub.cancel();
    return super.close();
  }
}
