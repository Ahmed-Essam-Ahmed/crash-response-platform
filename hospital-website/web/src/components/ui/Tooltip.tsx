import type { ReactNode } from 'react';

export function Tooltip({
  label,
  children,
  side = 'bottom',
  className = '',
}: {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}) {
  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-2xs font-medium text-bg opacity-0 shadow-[var(--shadow-pop)] transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}
      >
        {label}
      </span>
    </span>
  );
}
