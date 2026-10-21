import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../application/app_services.dart';
import '../../domain/domain.dart';
import '../../services/storage/event_repository_memory.dart';
import '../app.dart';
import '../theme.dart';
import '../widgets/format.dart';

/// Accident History (task step 11).
class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = context.read<AppServices>().events;
    return Scaffold(
      appBar: AppBar(title: const Text('Accident history')),
      body: Column(
        children: [
          const _TripsSummary(),
          Expanded(child: _EventList(store: store)),
        ],
      ),
    );
  }
}

class _TripsSummary extends StatelessWidget {
  const _TripsSummary();

  @override
  Widget build(BuildContext context) {
    final sessions = context.read<AppServices>().sessions;
    if (sessions == null) return const SizedBox.shrink();
    final text = Theme.of(context).textTheme;
    return StreamBuilder<List<DrivingSession>>(
      stream: sessions.watchSessions(),
      builder: (context, snap) {
        final list = snap.data ?? const <DrivingSession>[];
        final km = list.fold<double>(0, (a, s) => a + s.distanceKm);
        final top = list.fold<double>(0, (a, s) => s.maxSpeedKmh > a ? s.maxSpeedKmh : a);
        return Container(
          width: double.infinity,
          margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHigh,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _Stat('${list.length}', 'Trips', text),
              _Stat(km.toStringAsFixed(1), 'km driven', text),
              _Stat('${top.round()}', 'Top km/h', text),
            ],
          ),
        );
      },
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.value, this.label, this.text);
  final String value;
  final String label;
  final TextTheme text;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Text(value, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
          Text(label, style: text.bodySmall),
        ],
      );
}

class _EventList extends StatelessWidget {
  const _EventList({required this.store});
  final LocalEventStore store;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return StreamBuilder<List<AccidentEvent>>(
        stream: store.watch(),
        builder: (context, snap) {
          final events = snap.data ?? const <AccidentEvent>[];
          if (events.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.history, size: 64, color: scheme.outline),
                    const SizedBox(height: 16),
                    Text('No events yet', style: text.titleMedium),
                    const SizedBox(height: 8),
                    Text(
                      'Detected events appear here. Try Test Mode to create some.',
                      textAlign: TextAlign.center,
                      style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: events.length,
            separatorBuilder: (context, index) => const Divider(height: 1, indent: 72),
            itemBuilder: (context, i) {
              final e = events[i];
              final color = classColor(e.eventClass);
              return ListTile(
                leading: CircleAvatar(
                  backgroundColor: color.withValues(alpha: 0.15),
                  child: Icon(classIcon(e.eventClass), color: color),
                ),
                title: Text(e.eventClass.label, style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text(
                  '${formatDateTime(e.timestamp)} · ${placeLabel(e.location)}\n'
                  'Confidence: ${e.confidence.round()}%'
                  '${e.severity == null ? '' : ' · Severity: ${e.severity!.level.name.toUpperCase()}'}',
                ),
                isThreeLine: true,
                trailing: e.eventClass.isAccident
                    ? Chip(
                        label: Text(e.status == AccidentStatus.dispatched ? 'Alerted' : 'Cancelled'),
                        visualDensity: VisualDensity.compact,
                        side: BorderSide(
                          color: e.status == AccidentStatus.dispatched
                              ? AppColors.danger
                              : scheme.outlineVariant,
                        ),
                      )
                    : null,
                onTap: () => Navigator.of(context).pushNamed(Routes.detail, arguments: e.id),
              );
            },
          );
        },
    );
  }
}
