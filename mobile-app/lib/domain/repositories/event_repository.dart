// CONTRACT FILE — EventRepository (file 02 §6.5).
// Member A calls it, Member B (Hazem) implements it with drift + Firestore.

import '../entities/entities.dart';

abstract interface class EventRepository {
  /// Persist locally first (works offline). Queued for sync.
  Future<void> saveLocal(AccidentEvent event, {SensorWindow? window});

  /// Push everything not yet in Firestore. Returns how many were synced.
  Future<int> syncPending();

  /// Newest first.
  Future<List<AccidentEvent>> history();

  /// One event plus its stored sensor window (for the detail graph).
  Future<(AccidentEvent, SensorWindow?)?> eventDetail(String id);
}
