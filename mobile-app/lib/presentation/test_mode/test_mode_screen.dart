import 'dart:async';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../application/app_services.dart';
import '../../application/detection/scenario_generator.dart';
import '../../application/detection/sensor_fusion_engine.dart';
import '../theme.dart';
import '../widgets/format.dart';

/// Test Mode (task step 13) — the defense demo screen. Replays recorded
/// sensor data through the real detection engine; the ENGINE decides.
class TestModeScreen extends StatefulWidget {
  const TestModeScreen({super.key});

  @override
  State<TestModeScreen> createState() => _TestModeScreenState();
}

class _TestModeScreenState extends State<TestModeScreen> {
  Scenario? _selected;
  bool _running = false;
  final _points = <FlSpot>[];
  StreamSubscription<List<(double, double)>>? _sigSub;

  static const _icons = {
    Scenario.normalDriving: Icons.directions_car_outlined,
    Scenario.hardBraking: Icons.speed,
    Scenario.pothole: Icons.add_road,
    Scenario.sharpTurn: Icons.turn_sharp_right,
    Scenario.phoneDrop: Icons.phone_android,
    Scenario.severeImpact: Icons.car_crash,
    Scenario.rollover: Icons.rotate_90_degrees_ccw,
  };

  @override
  void initState() {
    super.initState();
    _sigSub = context.read<AppServices>().monitor.signal.listen((batch) {
      if (!_running || !mounted) return;
      setState(() {
        for (final (t, g) in batch) {
          _points.add(FlSpot(t, g));
        }
      });
    });
  }

  @override
  void dispose() {
    _sigSub?.cancel();
    super.dispose();
  }

  Future<void> _start() async {
    final s = _selected;
    if (s == null) return;
    final runner = context.read<AppServices>().scenarios;
    setState(() {
      _running = true;
      _points.clear();
    });
    await runner.run(s);
    if (mounted) setState(() => _running = false);
  }

  @override
  Widget build(BuildContext context) {
    final services = context.read<AppServices>();
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Test mode')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            Text(
              'Replays recorded phone-sensor data (accelerometer, gyroscope, GPS) '
              'through the detection engine. The engine — not the button — '
              'decides whether it was an accident.',
              style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final s in services.scenarios.scenarios)
                  ChoiceChip(
                    avatar: Icon(_icons[s], size: 18),
                    label: Text(s.label),
                    selected: _selected == s,
                    onSelected: _running ? null : (_) => setState(() => _selected = s),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              icon: _running
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.play_arrow_rounded),
              label: Text(_running ? 'Replaying sensor data…' : 'START SIMULATION'),
              onPressed: _selected == null || _running ? null : _start,
            ),
            const SizedBox(height: 20),
            Text('Accelerometer magnitude (g)', style: text.labelLarge),
            const SizedBox(height: 8),
            SizedBox(height: 170, child: _SignalChart(points: _points)),
            const SizedBox(height: 16),
            StreamBuilder<EngineStatus>(
              stream: services.monitor.status,
              initialData: services.monitor.currentStatus,
              builder: (context, snap) => _StatusPanel(status: snap.data!),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignalChart extends StatelessWidget {
  const _SignalChart({required this.points});
  final List<FlSpot> points;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    // Thin out for drawing speed.
    final shown = <FlSpot>[
      for (var i = 0; i < points.length; i += 2) points[i],
    ];
    return LineChart(
      duration: Duration.zero,
      LineChartData(
        minX: 0,
        maxX: ScenarioGenerator.durationSec,
        minY: 0,
        maxY: 9,
        lineBarsData: [
          LineChartBarData(
            spots: shown.isEmpty ? const [FlSpot(0, 1)] : shown,
            color: AppColors.danger,
            barWidth: 1.4,
            dotData: const FlDotData(show: false),
          ),
        ],
        extraLinesData: ExtraLinesData(
          horizontalLines: [
            HorizontalLine(
              y: 2.5,
              color: AppColors.warn,
              strokeWidth: 1,
              dashArray: [5, 4],
              label: HorizontalLineLabel(
                show: true,
                alignment: Alignment.topRight,
                style: const TextStyle(color: AppColors.warn, fontSize: 10),
                labelResolver: (_) => 'impact trigger 2.5 g',
              ),
            ),
          ],
        ),
        gridData: FlGridData(
          drawVerticalLine: false,
          getDrawingHorizontalLine: (_) => FlLine(color: scheme.outlineVariant, strokeWidth: 0.5),
        ),
        borderData: FlBorderData(show: false),
        titlesData: const FlTitlesData(
          topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, interval: 5, reservedSize: 22)),
          leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, interval: 2, reservedSize: 28)),
        ),
      ),
    );
  }
}

class _StatusPanel extends StatelessWidget {
  const _StatusPanel({required this.status});
  final EngineStatus status;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final d = status.decision;
    final isAccident = d?.eventClass?.isAccident ?? false;
    final color = switch (status.phase) {
      EnginePhase.verifying => AppColors.warn,
      EnginePhase.decided => isAccident ? AppColors.danger : AppColors.ok,
      _ => scheme.onSurfaceVariant,
    };
    final stage = switch (status.phase) {
      EnginePhase.idle => 'Engine idle',
      EnginePhase.monitoring => 'Stage 1 — watching every sample',
      EnginePhase.replaying => 'Stage 1 — watching every sample',
      EnginePhase.verifying => 'Stage 2 — verifying the seconds before & after',
      EnginePhase.decided => 'Decision',
    };

    return Card(
      elevation: 0,
      color: scheme.surfaceContainerHigh,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(stage.toUpperCase(),
                style: text.labelSmall?.copyWith(color: color, letterSpacing: 1, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Row(
              children: [
                if (d?.eventClass != null) ...[
                  Icon(classIcon(d!.eventClass!), color: color),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Text(status.headline,
                      style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: color)),
                ),
                if (d != null)
                  Text('${d.confidence.round()}%',
                      style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: color)),
              ],
            ),
            if (d != null) ...[
              const SizedBox(height: 4),
              Text('Crash confidence', style: text.bodySmall),
              const Divider(height: 20),
              for (final r in d.reasons)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.chevron_right, size: 18, color: scheme.onSurfaceVariant),
                      const SizedBox(width: 4),
                      Expanded(child: Text(r, style: text.bodyMedium)),
                    ],
                  ),
                ),
              const SizedBox(height: 8),
              Text(
                d.eventClass == null
                    ? 'Nothing is reported — no alert.'
                    : d.eventClass!.isAccident
                        ? 'Sent to the severity model → emergency flow if HIGH.'
                        : 'Logged to history — no alert.',
                style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

