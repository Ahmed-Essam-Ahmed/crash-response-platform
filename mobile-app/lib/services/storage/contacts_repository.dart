// Hazem-owned. Emergency contacts store.
// Now: in-memory. Weeks 4–6: drift locally + users/{uid}/emergencyContacts.

import 'dart:async';

import '../../domain/domain.dart';

abstract interface class ContactsRepository {
  Stream<List<EmergencyContact>> watch();
  List<EmergencyContact> get current;

  /// Replaces the whole list (used after add/remove/reorder).
  Future<void> saveAll(List<EmergencyContact> contacts);
}

class InMemoryContactsRepository implements ContactsRepository {
  InMemoryContactsRepository([List<EmergencyContact> initial = const []])
      : _items = List.unmodifiable(initial);

  final _controller = StreamController<List<EmergencyContact>>.broadcast();
  List<EmergencyContact> _items;

  @override
  List<EmergencyContact> get current => _items;

  @override
  Stream<List<EmergencyContact>> watch() async* {
    yield _items;
    yield* _controller.stream;
  }

  @override
  Future<void> saveAll(List<EmergencyContact> contacts) async {
    _items = List.unmodifiable(contacts);
    _controller.add(_items);
  }

  void dispose() => _controller.close();
}
