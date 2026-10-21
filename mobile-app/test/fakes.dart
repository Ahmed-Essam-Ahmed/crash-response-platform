import 'package:safedrive/domain/domain.dart';
import 'package:safedrive/services/location/location_provider.dart';
import 'package:safedrive/services/notifications/alert_dispatcher.dart';

class FakeLocationProvider implements LocationProvider {
  FakeLocationProvider([this.value]);
  GeoLocation? value;

  @override
  Future<GeoLocation?> current() async => value;

  @override
  Future<bool> ensurePermission() async => true;
}

class RecordingDispatcher implements AlertDispatcher {
  RecordingDispatcher({this.online = true});

  /// false = simulate no internet at the crash site.
  bool online;
  final calls = <(List<EmergencyContact>, String)>[];

  @override
  bool get isAutomatic => true;

  @override
  Future<DispatchReport> notifyContacts(List<EmergencyContact> contacts, String message) async {
    calls.add((contacts, message));
    return DispatchReport(
      push: online ? ChannelStatus.sent : ChannelStatus.failed,
      smsGateway: ChannelStatus.notConfigured,
      composer: ChannelStatus.needsUserTap,
    );
  }
}

class UnreachableSeverity implements SeverityModelClient {
  @override
  Future<Severity> getSeverity(FeatureVector f) async => throw StateError('offline');
}
