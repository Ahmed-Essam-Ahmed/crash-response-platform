import { motion, useReducedMotion } from 'motion/react';

function Skeleton({ className }: { className: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

function Tile({
  label,
  value,
  hint,
  tone,
  icon,
  index,
  reduce,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'critical' | 'mild';
  icon: React.ReactNode;
  index: number;
  reduce: boolean | null;
}) {
  const Icon = (
    <span
      data-tone={tone ?? 'mild'}
      className={`grid size-9 place-items-center rounded-[0.625rem] ${
        tone === 'critical' ? 'chip' : 'bg-primary-soft text-primary'
      }`}
    >
      {icon}
    </span>
  );

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: reduce ? 0 : index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="card group p-4 transition-shadow duration-300 hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">{label}</p>
        {Icon}
      </div>
      <p className="tnum mt-2 text-2xl leading-none font-semibold tracking-tight">{value}</p>
      <p className="mt-1.5 text-xs text-muted">{hint}</p>
    </motion.div>
  );
}

export function StatRow({
  active,
  critical,
  ambulancesOut,
  fleetTotal,
  bedsFree,
  bedsTotal,
  loading,
}: {
  active: number | null;
  critical: number;
  ambulancesOut: number;
  fleetTotal: number;
  bedsFree: number;
  bedsTotal: number;
  loading: boolean;
}) {
  const reduce = useReducedMotion();

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card space-y-3 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  const tiles = [
    {
      label: 'Open cases',
      value: String(active ?? 0),
      hint: active === 1 ? '1 patient being handled' : 'patients being handled',
      icon: (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 8v4m0 4h.01M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
        </svg>
      ),
    },
    {
      label: 'Critical',
      value: String(critical),
      hint: 'need the team ready',
      tone: 'critical' as const,
      icon: (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 8v4m0 4h.01M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
        </svg>
      ),
    },
    {
      label: 'Ambulances out',
      value: `${ambulancesOut}/${fleetTotal}`,
      hint: 'crews currently responding',
      icon: (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 16V8h11v8M14 11h3.5l2.5 3v2h-2M3 16h1.5M10 16h4" />
          <circle cx="7" cy="17" r="2" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      ),
    },
    {
      label: 'Beds free',
      value: `${bedsFree}/${bedsTotal}`,
      hint: 'across all hospitals',
      icon: (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v13M21 20V10M3 12h18M7 9h4a2 2 0 0 1 2 2v3H7V9ZM3 20h18" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile, i) => (
        <Tile key={tile.label} {...tile} index={i} reduce={reduce} />
      ))}
    </div>
  );
}
