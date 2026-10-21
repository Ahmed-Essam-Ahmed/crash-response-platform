import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../application/app_services.dart';
import '../../domain/domain.dart';
import '../theme.dart';
import '../widgets/event_map.dart';
import '../widgets/format.dart';

/// Accident Detail + sensor graphs ±10 s (task step 11, FR-14).
class AccidentDetailScreen extends StatelessWidget {
  const AccidentDetailScreen({super.key, required this.eventId});

  final String eventId;

  @override
  Widget build(BuildContext context) {
    final store = context.read<AppServices>().events;
    return Scaffold(
      appBar: AppBar(title: const Text('Event detail')),
      body: FutureBuilder<(AccidentEvent, SensorWindow?)?>(
        future: store.eventDetail(eventId),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          final data = snap.data;
          if (data == null) return const Center(child: Text('Event not found'));
          final (e, window) = data;
          return _Body(event: e, window: window);
        },
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.event, required this.window});

  final AccidentEvent event;
  final SensorWindow? window;

  @override
  Widget build(BuildContext context) {
    final e = event;
    final text = Theme.of(context).textTheme;
    final color = classColor(e.eventClass);
    final series = window == null ? null : _Series.from(window!);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
      children: [
        Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: color.withValues(alpha: 0.15),
              child: Icon(classIcon(e.eventClass), color: color),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(e.eventClass.label,
                      style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                  Text(formatDateTime(e.timestamp), style: text.bodyMedium),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Card(
          elevation: 0,
          color: Theme.of(context).colorScheme.surfaceContainerHigh,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _Row('Crash confidence', '${e.confidence.round()}%'),
                _Row('Severity', e.severity?.level.name.toUpperCase() ?? '—'),
                _Row('Max acceleration', '${e.maxAccel.toStringAsFixed(1)} g'),
                _Row('Max angular velocity', '${e.maxGyro.toStringAsFixed(2)} rad/s'),
                _Row('Speed before → after',
                    '${e.speedBefore.round()} → ${e.speedAfter.round()} km/h'),
                _Row('Possible rollover', e.rollover ? 'YES' : 'NO'),
                _Row('Location', placeLabel(e.location)),
                if (e.eventClass.isAccident)
                  _Row('Emergency',
                      e.status == AccidentStatus.dispatched ? 'Contacts alerted' : 'Cancelled by driver'),
              ],
            ),
          ),
        ),
        if (e.location != null) ...[
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: SizedBox(height: 180, child: EventMap(location: e.location!)),
          ),
        ],
        const SizedBox(height: 24),
        Text('Sensor data (10 s before → event → 10 s after)',
            style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        if (series == null)
          const Text('No sensor window stored for this event.')
        else ...[
          _Chart(title: 'Acceleration magnitude (g)', spots: series.accel, color: AppColors.danger),
          _Chart(title: 'Gyroscope magnitude (rad/s)', spots: series.gyro, color: AppColors.brand),
          _Chart(title: 'GPS speed (km/h)', spots: series.speed, color: AppColors.ok),
        ],
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(child: Text(label, style: text.bodyMedium)),
          Text(value, style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

/// Samples → chart points, x = seconds relative to the event,
/// downsampled to ≤ 200 points so charts stay smooth.
class _Series {
  _Series(this.accel, this.gyro, this.speed);

  final List<FlSpot> accel;
  final List<FlSpot> gyro;
  final List<FlSpot> speed;

  static _Series from(SensorWindow w) {
    final step = math.max(1, w.samples.length ~/ 200);
    final a = <FlSpot>[], g = <FlSpot>[], v = <FlSpot>[];
    for (var i = 0; i < w.samples.length; i += step) {
      final s = w.samples[i];
      final x = s.timestamp.difference(w.eventTime).inMilliseconds / 1000.0;
      final accG = math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az) / 9.81;
      final gyr = math.sqrt(s.gx * s.gx + s.gy * s.gy + s.gz * s.gz);
      a.add(FlSpot(x, accG));
      g.add(FlSpot(x, gyr));
      if (s.speedKmh != null) v.add(FlSpot(x, s.speedKmh!));
    }
    return _Series(a, g, v);
  }
}

class _Chart extends StatelessWidget {
  const _Chart({required this.title, required this.spots, required this.color});

  final String title;
  final List<FlSpot> spots;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (spots.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          SizedBox(
            height: 160,
            child: LineChart(
              LineChartData(
                minX: -10,
                maxX: 10,
                minY: 0,
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    color: color,
                    barWidth: 1.6,
                    isCurved: false,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(show: true, color: color.withValues(alpha: 0.08)),
                  ),
                ],
                extraLinesData: ExtraLinesData(
                  verticalLines: [
                    VerticalLine(
                      x: 0,
                      color: scheme.onSurface.withValues(alpha: 0.5),
                      strokeWidth: 1,
                      dashArray: [4, 4],
                    ),
                  ],
                ),
                gridData: FlGridData(
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (_) =>
                      FlLine(color: scheme.outlineVariant, strokeWidth: 0.5),
                ),
                borderData: FlBorderData(show: false),
                titlesData: const FlTitlesData(
                  topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(showTitles: true, interval: 5, reservedSize: 24),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(showTitles: true, reservedSize: 36),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
