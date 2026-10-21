import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/domain.dart';
import '../../services/storage/settings_repository.dart';
import '../app.dart';
import '../contacts/contacts_cubit.dart';
import '../driving/driving_cubit.dart';
import '../settings/settings_cubit.dart';
import '../widgets/status_row.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;

    // Driving is auto-detected: when the detector says "driving", open
    // Driving Mode (only if Home is the visible screen).
    return BlocListener<DrivingCubit, DrivingSnapshot>(
      listenWhen: (a, b) => a.status != b.status,
      listener: (context, s) {
        final isCurrent = ModalRoute.of(context)?.isCurrent ?? false;
        if (s.status == DrivingStatus.driving && isCurrent) {
          Navigator.of(context).pushNamed(Routes.driving);
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text('SafeDrive', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
          actions: [
            IconButton(
              tooltip: 'Settings',
              icon: const Icon(Icons.settings_outlined),
              onPressed: () => Navigator.of(context).pushNamed(Routes.settings),
            ),
          ],
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            children: [
              const _StatusCard(),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: scheme.secondaryContainer.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    Icon(Icons.auto_mode, color: scheme.onSecondaryContainer),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Driving starts automatically when you are moving '
                        'faster than about 20 km/h. You don\'t need to press anything.',
                        style: text.bodyMedium?.copyWith(color: scheme.onSecondaryContainer),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                icon: const Icon(Icons.play_arrow_rounded),
                label: const Text('START DRIVING (manual)'),
                onPressed: () => context.read<DrivingCubit>().startManual(),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                icon: const Icon(Icons.contacts_outlined),
                label: const Text('Emergency contacts'),
                onPressed: () => Navigator.of(context).pushNamed(Routes.contacts),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                icon: const Icon(Icons.history),
                label: const Text('Accident history'),
                onPressed: () => Navigator.of(context).pushNamed(Routes.history),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                icon: const Icon(Icons.science_outlined),
                label: const Text('Test mode'),
                onPressed: () => Navigator.of(context).pushNamed(Routes.testMode),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard();

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final drive = context.watch<DrivingCubit>().state;
    final settings = context.watch<SettingsCubit>().state;
    final contacts = context.watch<ContactsCubit>().state;
    final sensors = drive.sensors;

    final ready = sensors.canMonitor && settings.detectionEnabled && contacts.isNotEmpty;
    final (systemValue, systemTone) = switch (true) {
      _ when !sensors.canMonitor => ('NO SENSORS', StatusTone.danger),
      _ when !settings.detectionEnabled => ('PAUSED', StatusTone.warn),
      _ when contacts.isEmpty => ('SETUP NEEDED', StatusTone.warn),
      _ => ('READY', StatusTone.ok),
    };

    return Card(
      elevation: 0,
      color: Theme.of(context).colorScheme.surfaceContainerHigh,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('System status', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            StatusRow(
              icon: ready ? Icons.verified_user_outlined : Icons.error_outline,
              label: 'System',
              value: systemValue,
              tone: systemTone,
            ),
            StatusRow(
              icon: Icons.gps_fixed,
              label: 'GPS',
              value: sensors.gps ? 'CONNECTED' : 'UNAVAILABLE',
              tone: sensors.gps ? StatusTone.ok : StatusTone.warn,
            ),
            StatusRow(
              icon: Icons.vibration,
              label: 'Motion sensors',
              value: !sensors.accelerometer
                  ? 'MISSING'
                  : sensors.gyroscope
                      ? 'ACTIVE'
                      : 'LIMITED',
              tone: !sensors.accelerometer
                  ? StatusTone.danger
                  : sensors.gyroscope
                      ? StatusTone.ok
                      : StatusTone.warn,
            ),
            StatusRow(
              icon: Icons.contacts_outlined,
              label: 'Emergency contacts',
              value: contacts.isEmpty ? 'NONE' : '${contacts.length} CONFIGURED',
              tone: contacts.isEmpty ? StatusTone.warn : StatusTone.ok,
            ),
            _DetectionToggle(settings: settings),
          ],
        ),
      ),
    );
  }
}

class _DetectionToggle extends StatelessWidget {
  const _DetectionToggle({required this.settings});

  final AppSettings settings;

  @override
  Widget build(BuildContext context) {
    return StatusRow(
      icon: Icons.car_crash_outlined,
      label: 'Accident detection',
      value: settings.detectionEnabled ? 'ON' : 'OFF',
      trailing: Switch(
        value: settings.detectionEnabled,
        onChanged: (v) => context.read<SettingsCubit>().setDetectionEnabled(v),
      ),
    );
  }
}
