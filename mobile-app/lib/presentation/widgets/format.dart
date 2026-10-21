import 'package:flutter/material.dart';

import '../../domain/domain.dart';
import '../theme.dart';

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

String _two(int n) => n.toString().padLeft(2, '0');

String formatDateTime(DateTime t) =>
    '${t.day} ${_months[t.month - 1]} ${t.year}, ${_two(t.hour)}:${_two(t.minute)}:${_two(t.second)}';

/// No reverse geocoding yet (needs a network service) — show coordinates.
String placeLabel(GeoLocation? l) => l == null
    ? 'Location unknown'
    : '${l.latitude.toStringAsFixed(4)}, ${l.longitude.toStringAsFixed(4)}';

Color classColor(EventClass c) => switch (c) {
      EventClass.normalDriving => AppColors.ok,
      EventClass.hardBraking || EventClass.pothole || EventClass.sharpTurn => AppColors.warn,
      EventClass.possibleAccident => AppColors.warn,
      EventClass.severeAccident || EventClass.possibleRollover => AppColors.danger,
    };

IconData classIcon(EventClass c) => switch (c) {
      EventClass.normalDriving => Icons.directions_car_outlined,
      EventClass.hardBraking => Icons.speed,
      EventClass.pothole => Icons.add_road,
      EventClass.sharpTurn => Icons.turn_sharp_right,
      EventClass.possibleAccident => Icons.report_problem_outlined,
      EventClass.severeAccident => Icons.car_crash,
      EventClass.possibleRollover => Icons.rotate_90_degrees_ccw,
    };
