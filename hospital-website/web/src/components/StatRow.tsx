import type { ReactNode } from 'react';

function Stat({
  label,
  value,
  hint,
  accent,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
  icon: ReactNode;
}) {
  return (
    <div className="card shadow-soft p-4 transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">{label}</p>
        <span
          className={`grid h-8 w-8 place-items-center rounded-lg ${
            accent ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400' : 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
}

export function StatRow({
  active,
  critical,
  ambulancesOut,
  fleetTotal,
  bedsFree,
  bedsTotal,
}: {
  active: number;
  critical: number;
  ambulancesOut: number;
  fleetTotal: number;
  bedsFree: number;
  bedsTotal: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      <Stat
        label="Open cases"
        value={active}
        hint={active === 1 ? '1 patient on the way' : 'patients being handled'}
        icon={<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 8v4m0 4h.01M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /></svg>}
      />
      <Stat
        label="Critical"
        value={critical}
        hint="need the team ready"
        accent={critical > 0}
        icon={<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 9v4m0 4h.01M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /></svg>}
      />
      <Stat
        label="Ambulances out"
        value={`${ambulancesOut}/${fleetTotal}`}
        hint="crews currently responding"
        icon={<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 16V8h11v8M14 11h3.5l2.5 3v2h-2M3 16h1.5M10 16h4" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></svg>}
      />
      <Stat
        label="Beds free"
        value={`${bedsFree}/${bedsTotal}`}
        hint="across all hospitals"
        icon={<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v13M21 20V10M3 12h18M7 9h4a2 2 0 0 1 2 2v3H7V9ZM3 20h18" /></svg>}
      />
    </div>
  );
}
