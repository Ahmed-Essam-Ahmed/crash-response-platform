import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function StatCard({
  label,
  value,
  sub,
  icon: Shape,
  tone = 'primary',
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: 'primary' | 'signal' | 'success' | 'warning';
}) {
  const toneColor =
    tone === 'signal'
      ? 'text-[var(--signal)]'
      : tone === 'success'
        ? 'text-[var(--success)]'
        : tone === 'warning'
          ? 'text-[var(--warning)]'
          : 'text-[var(--primary)]';
  return (
    <div className="card fx p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs font-semibold tracking-wide text-muted uppercase">{label}</p>
        {Shape && <Icon icon={Shape} size={15} className={toneColor} />}
      </div>
      <p className="tnum mt-1.5 text-2xl font-semibold font-display">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
