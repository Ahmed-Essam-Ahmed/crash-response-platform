import 'package:flutter/material.dart';

import '../theme.dart';

enum StatusTone { ok, warn, danger, neutral }

/// "GPS ........ CONNECTED" style row used on Home and Driving Mode.
class StatusRow extends StatelessWidget {
  const StatusRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.tone = StatusTone.ok,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final String value;
  final StatusTone tone;
  final Widget? trailing;

  Color _color(BuildContext context) => switch (tone) {
        StatusTone.ok => AppColors.ok,
        StatusTone.warn => AppColors.warn,
        StatusTone.danger => AppColors.danger,
        StatusTone.neutral => Theme.of(context).colorScheme.onSurfaceVariant,
      };

  @override
  Widget build(BuildContext context) {
    final color = _color(context);
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 22, color: Theme.of(context).colorScheme.onSurfaceVariant),
          const SizedBox(width: 14),
          Expanded(child: Text(label, style: text.bodyLarge)),
          trailing ??
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  value,
                  style: text.labelLarge?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
        ],
      ),
    );
  }
}
