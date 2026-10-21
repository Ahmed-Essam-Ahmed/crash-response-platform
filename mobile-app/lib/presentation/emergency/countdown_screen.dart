import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../application/emergency/emergency_cubit.dart';
import '../../domain/domain.dart';
import '../../services/notifications/alarm_player.dart';

/// Full-screen, loud, one huge button (FR-09, FR-10).
class CountdownScreen extends StatefulWidget {
  const CountdownScreen({super.key});

  @override
  State<CountdownScreen> createState() => _CountdownScreenState();
}

class _CountdownScreenState extends State<CountdownScreen> {
  final _alarm = AlarmPlayer();

  @override
  void initState() {
    super.initState();
    _alarm.start();
  }

  @override
  void dispose() {
    _alarm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const red = Color(0xFFB3261E);
    final text = Theme.of(context).textTheme;
    return PopScope(
      canPop: false,
      child: BlocBuilder<EmergencyCubit, EmergencyState>(
        buildWhen: (_, s) => s is EmergencyCountdown,
        builder: (context, state) {
          if (state is! EmergencyCountdown) {
            return const Scaffold(backgroundColor: red);
          }
          final r = state.result;
          final f = r.features;
          final rollover = r.eventClass == EventClass.possibleRollover || f.orientationDelta >= 90;
          return Scaffold(
            backgroundColor: red,
            body: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 48),
                    const SizedBox(height: 8),
                    Text(
                      'POSSIBLE SEVERE ACCIDENT',
                      textAlign: TextAlign.center,
                      style: text.headlineSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 20),
                    _Fact('Crash confidence', '${r.confidence.round()}%'),
                    _Fact('Impact', f.peakAccel >= 6 ? 'HIGH' : f.peakAccel >= 3 ? 'MEDIUM' : 'LOW'),
                    _Fact('Speed before event', '${f.speedBefore.round()} km/h'),
                    _Fact('Possible rollover', rollover ? 'YES' : 'NO'),
                    _Fact(
                      'Severity',
                      '${state.severity.level.name.toUpperCase()}'
                          '${state.severityFromModel ? '' : ' (offline estimate)'}',
                    ),
                    const Spacer(),
                    Text(
                      'Emergency response in',
                      textAlign: TextAlign.center,
                      style: text.titleMedium?.copyWith(color: Colors.white70),
                    ),
                    Center(
                      child: SizedBox(
                        width: 150,
                        height: 150,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            CircularProgressIndicator(
                              value: state.remaining / state.total,
                              strokeWidth: 8,
                              color: Colors.white,
                              backgroundColor: Colors.white24,
                            ),
                            Center(
                              child: Text(
                                '${state.remaining}',
                                style: text.displayLarge?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const Spacer(),
                    SizedBox(
                      height: 96,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: red,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                          textStyle: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900),
                        ),
                        onPressed: () => context.read<EmergencyCubit>().cancel(),
                        child: const Text("I'M OK"),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      style: TextButton.styleFrom(foregroundColor: Colors.white),
                      onPressed: () => context.read<EmergencyCubit>().dispatch(),
                      child: const Text('I need help — alert now'),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: text.bodyLarge?.copyWith(color: Colors.white70)),
          ),
          Text(
            value,
            style: text.titleMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}
