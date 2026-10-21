import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../application/app_services.dart';
import '../../application/detection/scenario_generator.dart';
import '../../application/detection/sensor_fusion_engine.dart';
import '../../domain/domain.dart';
import '../theme.dart';
import '../widgets/status_row.dart';
import 'driving_cubit.dart';

/// Minimal on purpose — the driver should not be reading this.
class DrivingScreen extends StatelessWidget {
  const DrivingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;

    return BlocConsumer<DrivingCubit, DrivingSnapshot>(
      listenWhen: (a, b) => a.status != b.status,
      listener: (context, s) {
        // Session ended (auto-stop after dwell, or manual) → back to Home.
        // pop() (not maybePop) because PopScope still blocks until rebuild.
        final nav = Navigator.of(context);
        if (s.status == DrivingStatus.idle && nav.canPop()) nav.pop();
      },
      builder: (context, s) {
        final sensors = s.sensors;
        return PopScope(
          // Leaving this screen must not silently stop monitoring.
          canPop: s.status == DrivingStatus.idle,
          child: Scaffold(
            body: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        const _Pulse(),
                        const SizedBox(width: 10),
                        Text(
                          'DRIVING MODE',
                          style: text.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.2,
                          ),
                        ),
                        const Spacer(),
                        if (s.autoDetected)
                          const Chip(
                            label: Text('Auto'),
                            avatar: Icon(Icons.auto_mode, size: 18),
                            visualDensity: VisualDensity.compact,
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('Monitoring...', style: text.bodyLarge?.copyWith(color: scheme.onSurfaceVariant)),
                    const Spacer(),
                    Center(
                      child: Text(
                        s.speedKmh.round().toString(),
                        style: text.displayLarge?.copyWith(
                          fontSize: 120,
                          fontWeight: FontWeight.w300,
                          height: 1,
                        ),
                      ),
                    ),
                    Center(child: Text('km/h', style: text.titleLarge?.copyWith(color: scheme.onSurfaceVariant))),
                    const Spacer(),
                    StatusRow(
                      icon: Icons.gps_fixed,
                      label: 'GPS',
                      value: sensors.gps ? 'Connected' : 'Unavailable',
                      tone: sensors.gps ? StatusTone.ok : StatusTone.warn,
                    ),
                    _MotionRow(sensorsOk: sensors.accelerometer),
                    const StatusRow(
                      icon: Icons.shield_outlined,
                      label: 'System',
                      value: 'ACTIVE',
                    ),
                    // DEMO ONLY (debug builds): fake what Ahmed's engine would
                    // detect from the real sensors during this drive.
                    if (kDebugMode) ...[
                      const SizedBox(height: 12),
                      const _DemoEvents(),
                    ],
                    const SizedBox(height: 20),
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.danger,
                        side: const BorderSide(color: AppColors.danger),
                      ),
                      onPressed: () => context.read<DrivingCubit>().stopManual(),
                      child: const Text('STOP DRIVING'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Pulse extends StatefulWidget {
  const _Pulse();

  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween(begin: 0.35, end: 1.0).animate(_c),
      child: Container(
        width: 12,
        height: 12,
        decoration: const BoxDecoration(color: AppColors.ok, shape: BoxShape.circle),
      ),
    );
  }
}

class _DemoEvents extends StatelessWidget {
  const _DemoEvents();

  @override
  Widget build(BuildContext context) {
    final runner = context.read<AppServices>().scenarios;
    final scheme = Theme.of(context).colorScheme;
    Widget chip(String label, IconData icon, Scenario c) => ActionChip(
          avatar: Icon(icon, size: 18),
          label: Text(label),
          onPressed: () => runner.run(c),
        );
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        border: Border.all(color: scheme.outlineVariant),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Demo — feed recorded sensor data to the engine',
              style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              chip('Crash', Icons.car_crash, Scenario.severeImpact),
              chip('Rollover', Icons.rotate_90_degrees_ccw, Scenario.rollover),
              chip('Pothole', Icons.add_road, Scenario.pothole),
              chip('Hard brake', Icons.speed, Scenario.hardBraking),
              chip('Phone drop', Icons.phone_android, Scenario.phoneDrop),
            ],
          ),
        ],
      ),
    );
  }
}

/// Live engine state: "Normal" while watching, "Analyzing…" during Stage 2,
/// then the decision for a few seconds.
class _MotionRow extends StatelessWidget {
  const _MotionRow({required this.sensorsOk});
  final bool sensorsOk;

  @override
  Widget build(BuildContext context) {
    final monitor = context.read<AppServices>().monitor;
    return StreamBuilder<EngineStatus>(
      stream: monitor.status,
      initialData: monitor.currentStatus,
      builder: (context, snap) {
        final st = snap.data!;
        if (!sensorsOk) {
          return const StatusRow(
              icon: Icons.vibration, label: 'Motion', value: 'Missing', tone: StatusTone.danger);
        }
        final d = st.decision;
        final (value, tone) = switch (st.phase) {
          EnginePhase.replaying => ('Replaying data', StatusTone.neutral),
          EnginePhase.verifying => ('Analyzing event…', StatusTone.warn),
          EnginePhase.decided when d?.eventClass?.isAccident ?? false =>
            (d!.eventClass!.label, StatusTone.danger),
          EnginePhase.decided when d?.eventClass != null => (d!.eventClass!.label, StatusTone.warn),
          EnginePhase.decided => ('Normal', StatusTone.ok),
          _ => ('Normal', StatusTone.ok),
        };
        return StatusRow(icon: Icons.vibration, label: 'Motion', value: value, tone: tone);
      },
    );
  }
}
