import type { ReactNode } from 'react';

export type Tone = 'primary' | 'signal' | 'success' | 'warning' | 'info' | 'neutral';

function toneClasses(tone: Tone) {
  switch (tone) {
    case 'signal':
      return 'bg-[var(--signal-soft)] text-[var(--signal-ink)]';
    case 'success':
      return 'bg-[color-mix(in_oklab,var(--success)_18%,var(--surface))] text-[var(--success)]';
    case 'warning':
      return 'bg-[color-mix(in_oklab,var(--warning)_22%,var(--surface))] text-[color-mix(in_oklab,var(--warning)_72%,var(--ink))]';
    case 'info':
      return 'bg-[color-mix(in_oklab,var(--info)_18%,var(--surface))] text-[var(--info)]';
    case 'primary':
      return 'bg-[var(--primary-soft)] text-[var(--primary-ink)]';
    default:
      return 'surface-2 text-muted';
  }
}

export function Badge({
  children,
  tone = 'primary',
  dot = false,
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold ${toneClasses(tone)} ${className}`}
    >
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}
