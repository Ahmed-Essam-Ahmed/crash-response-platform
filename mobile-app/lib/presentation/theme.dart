import 'package:flutter/material.dart';

class AppColors {
  static const brand = Color(0xFF0F4C81); // deep road-sign blue
  static const ok = Color(0xFF1E8E3E);
  static const warn = Color(0xFFE37400);
  static const danger = Color(0xFFC5221F);
}

ThemeData buildTheme(Brightness brightness) {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.brand,
    brightness: brightness,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: scheme.surface,
    appBarTheme: AppBarTheme(
      centerTitle: false,
      backgroundColor: scheme.surface,
      foregroundColor: scheme.onSurface,
      elevation: 0,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(64, 56),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(64, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
  );
}
