import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../application/app_services.dart';
import '../../services/permissions/permission_service.dart';
import '../app.dart';
import '../theme.dart';

/// Shown once after onboarding and from Settings. Every deny path is handled:
/// the app keeps working in a degraded mode and says exactly what is missing.
class PermissionsScreen extends StatefulWidget {
  const PermissionsScreen({super.key, this.fromOnboarding = false});

  final bool fromOnboarding;

  @override
  State<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends State<PermissionsScreen> with WidgetsBindingObserver {
  final _states = <AppPermission, PermState>{};

  static const _info = {
    AppPermission.location: (
      Icons.location_on_outlined,
      'Location (while using)',
      'Needed to send your position to your contacts after an accident.',
      'Without it, contacts get the alert but no map link.',
    ),
    AppPermission.backgroundLocation: (
      Icons.my_location,
      'Location — Allow all the time',
      'Lets SafeDrive notice you are driving with the screen off.',
      'Without it, start driving mode manually from the Home screen.',
    ),
    AppPermission.notifications: (
      Icons.notifications_active_outlined,
      'Notifications',
      'Shows the emergency countdown even if the app is in the background.',
      'Without it, the alarm only appears while the app is open.',
    ),
    AppPermission.motion: (
      Icons.vibration,
      'Motion & physical activity',
      'iPhone: reads the motion sensors to detect an impact. Android: recognises that you are driving.',
      'Without it, detection is limited — start driving mode manually.',
    ),
  };

  PermissionService get _svc => context.read<AppServices>().permissions;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Coming back from the system Settings page → re-read.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  Future<void> _refresh() async {
    for (final p in AppPermission.values) {
      final s = await _svc.status(p);
      if (!mounted) return;
      setState(() => _states[p] = s);
    }
  }

  Future<void> _ask(AppPermission p) async {
    final current = _states[p];
    if (current == PermState.permanentlyDenied) {
      await _svc.openSettings();
      return;
    }
    final s = await _svc.request(p);
    if (mounted) setState(() => _states[p] = s);
  }

  void _done() {
    if (widget.fromOnboarding) {
      Navigator.of(context).pushReplacementNamed(Routes.home);
    } else {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Permissions'),
        automaticallyImplyLeading: !widget.fromOnboarding,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            Text(
              'SafeDrive works best with these. You can change them any time in Settings.',
              style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: 12),
            for (final p in AppPermission.values)
              if (_states[p] != PermState.notApplicable) _tile(p),
            const SizedBox(height: 20),
            FilledButton(onPressed: _done, child: Text(widget.fromOnboarding ? 'Continue' : 'Done')),
          ],
        ),
      ),
    );
  }

  Widget _tile(AppPermission p) {
    final (icon, title, why, ifDenied) = _info[p]!;
    final s = _states[p];
    final ok = s == PermState.granted || s == PermState.limited;
    final text = Theme.of(context).textTheme;
    return Card(
      elevation: 0,
      color: Theme.of(context).colorScheme.surfaceContainerHigh,
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: ok ? AppColors.ok : AppColors.warn),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(why, style: text.bodySmall),
                  if (!ok && s != null) ...[
                    const SizedBox(height: 4),
                    Text(ifDenied, style: text.bodySmall?.copyWith(color: AppColors.warn)),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (s == null)
              const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
            else if (ok)
              const Icon(Icons.check_circle, color: AppColors.ok)
            else
              TextButton(
                onPressed: () => _ask(p),
                child: Text(s == PermState.permanentlyDenied ? 'Settings' : 'Allow'),
              ),
          ],
        ),
      ),
    );
  }
}
