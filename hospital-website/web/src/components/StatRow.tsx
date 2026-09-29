import { motion, useReducedMotion } from 'motion/react';
import { AnimatedNumber } from './AnimatedNumber';

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
  value: React.ReactNode;
  hint: string;
  tone?: 'critical' | 'mild' | 'primary';
  icon: React.ReactNode;
  index: number;
  reduce: boolean | null;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: reduce ? 0 : index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">{label}</p>
        <span
          data-tone={tone ?? 'mild'}
          className={`grid size-9 place-items-center rounded-[0.625rem] ${
            tone === 'primary' ? 'bg-primary-soft text-primary' : 'chip'
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl leading-none font-semibold tracking-tight">{value}</p>
      <p className="mt-1.5 text-xs text-muted">{hint}</p>
    </motion.div>
  );
}

const ICONS = {
  inbox: (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v9m0 0 3.5-3.5M12 12 8.5 8.5" />
      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  ),
  cases: (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7a2 2 0 0 1 2-2h1.5l1 2H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M12 10v5m-2.5-2.5h5" />
    </svg>
  ),
  critical: (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v4m0 4h.01M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
    </svg>
  ),
  ambulance: (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16V8h11v8M14 11h3.5l2.5 3v2h-2M3 16h1.5M10 16h4" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  ),
  beds: (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v13M21 20V10M3 12h18M7 9h4a2 2 0 0 1 2 2v3H7V9Z" />
    </svg>
  ),
} as const;

export function StatRow({
  offers,
  active,
  critical,
  ambulancesAvailable,
  ambulancesTotal,
  bedsFree,
  bedsTotal,
  loading,
}: {
  offers: number;
  active: number;
  critical: number;
  ambulancesAvailable: number;
  ambulancesTotal: number;
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
      label: 'Waiting on you',
      value: <AnimatedNumber value={offers} />,
      hint: offers === 1 ? 'case offered to your hospital' : 'cases offered to your hospital',
      tone: 'mild' as const,
      icon: ICONS.inbox,
    },
    {
      label: 'Your open cases',
      value: <AnimatedNumber value={active} />,
      hint: active === 1 ? 'patient in your care' : 'patients in your care',
      tone: 'primary' as const,
      icon: ICONS.cases,
    },
    {
      label: 'Critical',
      value: <AnimatedNumber value={critical} />,
      hint: 'need the team ready',
      tone: 'critical' as const,
      icon: ICONS.critical,
    },
    {
      label: 'Ambulances ready',
      value: <AnimatedNumber value={ambulancesAvailable} format={() => `${ambulancesAvailable}/${ambulancesTotal}`} />,
      hint: 'crews free to respond',
      tone: 'mild' as const,
      icon: ICONS.ambulance,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile, i) => (
          <Tile key={tile.label} {...tile} index={i} reduce={reduce} />
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <span data-tone="mild" className="chip grid size-8 shrink-0 place-items-center rounded-lg">
          {ICONS.beds}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">Beds</p>
            <p className="tnum text-sm font-semibold">
              {bedsFree} free / {bedsTotal}
            </p>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${bedsTotal ? Math.round(((bedsTotal - bedsFree) / bedsTotal) * 100) : 0}%` }}
              transition={{ type: 'spring', stiffness: 140, damping: 22 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
