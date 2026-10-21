import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../application/app_services.dart';

/// Privacy & my data (task step 14).
class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  Future<void> _deleteAll(BuildContext context) async {
    final services = context.read<AppServices>();
    final messenger = ScaffoldMessenger.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete all my data?'),
        content: const Text(
          'This removes your accident history and emergency contacts from this '
          'phone (and from your account once sync is enabled). It cannot be undone.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    await services.events.deleteAll();
    await services.contacts.saveAll(const []);
    messenger.showSnackBar(const SnackBar(content: Text('Your data was deleted')));
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Privacy & my data')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          const _Section(
            icon: Icons.phone_android,
            title: 'Stays on your phone',
            body: 'Raw motion and GPS data while driving (kept in memory for about '
                '2 minutes, then discarded), your settings, and a local copy of '
                'your history so detection works offline.',
          ),
          const _Section(
            icon: Icons.cloud_upload_outlined,
            title: 'Uploaded to your account',
            body: 'Only detected events: type, time, confidence, severity, location '
                'and ~20 seconds of sensor data around each event. Your emergency '
                'contacts, so they are not lost if you change phones.',
          ),
          const _Section(
            icon: Icons.location_on_outlined,
            title: 'Location sharing',
            body: 'Your location is sent to your contacts ONLY when an emergency '
                'alert is actually dispatched (you did not press I\'M OK).',
          ),
          const _Section(
            icon: Icons.mic_off_outlined,
            title: 'No audio',
            body: 'SafeDrive never records the microphone.',
          ),
          const _Section(
            icon: Icons.lock_outline,
            title: 'Security',
            body: 'Your account data is only readable by you (per-user database '
                'rules), all traffic uses HTTPS/TLS, and sign-in tokens are kept in '
                'the phone\'s secure storage.',
          ),
          const _Section(
            icon: Icons.timer_outlined,
            title: 'Retention',
            body: 'History is kept until you delete it. You can delete everything '
                'below at any time.',
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error),
            icon: const Icon(Icons.delete_forever_outlined),
            label: const Text('Delete my data'),
            onPressed: () => _deleteAll(context),
          ),
          const SizedBox(height: 8),
          Text(
            'Sign-in and cloud sync are added in the backend step.',
            style: text.bodySmall,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.icon, required this.title, required this.body});

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: scheme.primary),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(body, style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
