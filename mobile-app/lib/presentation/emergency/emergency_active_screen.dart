import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../application/emergency/emergency_cubit.dart';
import '../../services/notifications/alert_dispatcher.dart';
import '../theme.dart';
import '../widgets/event_map.dart';

/// After timeout: one-tap call / SMS / share (FR-11, FR-12).
class EmergencyActiveScreen extends StatelessWidget {
  const EmergencyActiveScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;

    return PopScope(
      canPop: false,
      child: BlocBuilder<EmergencyCubit, EmergencyState>(
        buildWhen: (_, s) => s is EmergencyActive || s is EmergencyDispatching,
        builder: (context, state) {
          if (state is! EmergencyActive) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          final e = state.event;
          final loc = e.location;
          final first = state.contacts.isEmpty ? null : state.contacts.first;
          final numbers = state.contacts.map((c) => c.phone).toList();
          final auto = state.report.anyAutomaticSent;

          return Scaffold(
            appBar: AppBar(
              automaticallyImplyLeading: false,
              title: const Text('Emergency active'),
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
            ),
            body: SafeArea(
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: (auto ? AppColors.ok : AppColors.warn).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        Icon(auto ? Icons.check_circle : Icons.info_outline,
                            color: auto ? AppColors.ok : AppColors.warn),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            auto
                                ? 'Your emergency contacts have been alerted automatically '
                                    'with your location.'
                                : state.contacts.isEmpty
                                    ? 'No emergency contacts are set. Call for help below.'
                                    : 'Tap "Send alert SMS" to alert your ${state.contacts.length} '
                                        'contact(s). Automatic sending needs the backend (coming soon).',
                            style: text.bodyMedium,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (state.report.details.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    for (final d in state.report.details)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: Row(
                          children: [
                            Icon(
                              d.contains('failed') ? Icons.error_outline : Icons.check,
                              size: 18,
                              color: d.contains('failed') ? AppColors.danger : AppColors.ok,
                            ),
                            const SizedBox(width: 8),
                            Expanded(child: Text(d, style: text.bodySmall)),
                          ],
                        ),
                      ),
                  ],
                  const SizedBox(height: 16),
                  if (loc != null) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: SizedBox(height: 180, child: EventMap(location: loc)),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${loc.latitude.toStringAsFixed(5)}, ${loc.longitude.toStringAsFixed(5)}',
                      style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                    ),
                  ] else
                    Text('Location unavailable', style: text.bodyMedium),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
                    icon: const Icon(Icons.local_hospital),
                    label: const Text('Call emergency services (${PhoneActions.emergencyNumber})'),
                    onPressed: () => PhoneActions.call(PhoneActions.emergencyNumber),
                  ),
                  const SizedBox(height: 12),
                  if (first != null)
                    FilledButton.tonalIcon(
                      icon: const Icon(Icons.call),
                      label: Text('Call ${first.name}'),
                      onPressed: () => PhoneActions.call(first.phone),
                    ),
                  if (first != null) const SizedBox(height: 12),
                  if (numbers.isNotEmpty)
                    FilledButton.tonalIcon(
                      icon: const Icon(Icons.sms),
                      label: Text(auto ? 'Send SMS again from this phone' : 'Send alert SMS to contacts'),
                      onPressed: () => PhoneActions.sms(numbers, state.message),
                    ),
                  if (numbers.isNotEmpty) const SizedBox(height: 12),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.share_location),
                    label: const Text('Share location'),
                    onPressed: () => PhoneActions.sms(const [], state.message),
                  ),
                  const SizedBox(height: 24),
                  ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    title: const Text('Message sent to contacts'),
                    children: [
                      SelectableText(state.message, style: text.bodySmall),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => context.read<EmergencyCubit>().resolve(),
                    child: const Text("I'm safe now — close"),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
