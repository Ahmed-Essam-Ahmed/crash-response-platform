// Hazem-owned implementation of the shared EventRepository contract.
// Now: in-memory (works offline, lost on restart).
// Next: drift (SQLite) locally + Firestore sync — same interface, so callers
// (Ahmed's engine, EmergencyController, History) do not change.

import 'dart:async';

import '../../domain/domain.dart';

/// EventRepository plus what the History and Privacy screens need.
abstract interface class LocalEventStore implements EventRepository {
  Stream<List<AccidentEvent>> watch();
  Future<void> deleteAll();
}

class InMemoryEventRepository implements LocalEventStore {
  final _events = <AccidentEvent>[];
  final _windows = <String, SensorWindow>{};
  final _pending = <String>{};
  final _controller = StreamController<List<AccidentEvent>>.broadcast();

  /// Live history for the History screen (newest first).
  @override
  Stream<List<AccidentEvent>> watch() async* {
    yield _sorted();
    yield* _controller.stream;
  }

  List<AccidentEvent> _sorted() =>
      List.unmodifiable([..._events]..sort((a, b) => b.timestamp.compareTo(a.timestamp)));

  int get pendingCount => _pending.length;

  @override
  Future<void> saveLocal(AccidentEvent event, {SensorWindow? window}) async {
    _events.removeWhere((e) => e.id == event.id);
    _events.add(event);
    if (window != null) _windows[window.id] = window;
    _pending.add(event.id);
    _controller.add(_sorted());
  }

  @override
  Future<int> syncPending() async {
    // No backend yet: pretend everything uploaded.
    final n = _pending.length;
    _pending.clear();
    return n;
  }

  @override
  Future<List<AccidentEvent>> history() async => _sorted();

  @override
  Future<(AccidentEvent, SensorWindow?)?> eventDetail(String id) async {
    for (final e in _events) {
      if (e.id == id) {
        final ref = e.sensorWindowRef;
        return (e, ref == null ? null : _windows[ref]);
      }
    }
    return null;
  }

  /// Privacy screen → "Delete my data".
  @override
  Future<void> deleteAll() async {
    _events.clear();
    _windows.clear();
    _pending.clear();
    _controller.add(_sorted());
  }

  void dispose() => _controller.close();
}
