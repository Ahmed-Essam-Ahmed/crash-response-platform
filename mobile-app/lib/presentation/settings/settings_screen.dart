import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../services/storage/settings_repository.dart';
import '../app.dart';
import 'settings_cubit.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: BlocBuilder<SettingsCubit, AppSettings>(
        builder: (context, s) {
          final cubit = context.read<SettingsCubit>();
          return ListView(
            padding: const EdgeInsets.symmetric(vertical: 8),
            children: [
              const _Header('Detection'),
              SwitchListTile(
                title: const Text('Accident detection'),
                subtitle: const Text('Watch for crashes while driving'),
                value: s.detectionEnabled,
                onChanged: cubit.setDetectionEnabled,
              ),
              const _Header('Emergency countdown'),
              ListTile(
                title: const Text('Countdown before alerting contacts'),
                subtitle: Text('${s.user.countdownSec} seconds'),
              ),
              Slider(
                min: SettingsCubit.minCountdown.toDouble(),
                max: SettingsCubit.maxCountdown.toDouble(),
                divisions: (SettingsCubit.maxCountdown - SettingsCubit.minCountdown) ~/ 5,
                value: s.user.countdownSec.toDouble(),
                label: '${s.user.countdownSec} s',
                onChanged: (v) => cubit.setCountdown(v.round()),
              ),
              const _Header('Sensitivity'),
              ListTile(
                title: const Text('Crash confidence threshold'),
                subtitle: Text(
                  '${s.user.confidenceThreshold}% — used if the severity model '
                  'can\'t be reached. Lower = more alerts.',
                ),
              ),
              Slider(
                min: SettingsCubit.minThreshold.toDouble(),
                max: SettingsCubit.maxThreshold.toDouble(),
                divisions: (SettingsCubit.maxThreshold - SettingsCubit.minThreshold) ~/ 5,
                value: s.user.confidenceThreshold.toDouble(),
                label: '${s.user.confidenceThreshold}%',
                onChanged: (v) => cubit.setThreshold(v.round()),
              ),
              const _Header('More'),
              ListTile(
                leading: const Icon(Icons.history),
                title: const Text('Accident history'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed(Routes.history),
              ),
              ListTile(
                leading: const Icon(Icons.science_outlined),
                title: const Text('Test mode'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed(Routes.testMode),
              ),
              ListTile(
                leading: const Icon(Icons.contacts_outlined),
                title: const Text('Emergency contacts'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed(Routes.contacts),
              ),
              ListTile(
                leading: const Icon(Icons.verified_user_outlined),
                title: const Text('Permissions'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed(Routes.permissions),
              ),
              ListTile(
                leading: const Icon(Icons.privacy_tip_outlined),
                title: const Text('Privacy & my data'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed(Routes.privacy),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  'Thresholds are experimental values and will be tuned '
                  'from our test data.',
                  style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
      child: Text(
        title.toUpperCase(),
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: Theme.of(context).colorScheme.primary,
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
            ),
      ),
    );
  }
}
