import type { LucideIcon } from 'lucide-react';

export const ICON_STROKE = 1.8;

/**
 * One way to draw every icon on the site. lucide-react supplies the shapes;
 * this wrapper fixes the stroke weight, sizing, and accessibility contract so
 * icons never drift apart screen to screen.
 */
export function Icon({
  icon: Shape,
  size = 18,
  strokeWidth = ICON_STROKE,
  className = '',
  label,
}: {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}) {
  if (label) {
    return (
      <Shape
        width={size}
        height={size}
        strokeWidth={strokeWidth}
        className={className}
        role="img"
        aria-label={label}
      />
    );
  }
  return <Shape width={size} height={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}
