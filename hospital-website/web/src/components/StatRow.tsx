import { motion, useReducedMotion } from 'motion/react';
import { AnimatedNumber } from './AnimatedNumber';
import { useHoverFx } from '../lib/useHoverFx';

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
  tone?: 'critical' | 'mild';
  icon: React.ReactNode;
  index: number;
  reduce: boolean | null;
}) {
  const { node, onPointerMove, onPointerLeave } = useHoverFx();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: reduce ? 0 : index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 1000 }}
      className="card"
    >
      <div
        ref={node}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="fx fx-border h-full p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">{label}</p>
          <motion.span
            whileHover={reduce ? undefined : { scale: 1.12, rotate: -6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 20 }}
            data-tone={tone ?? 'mild'}
            className={`grid size-9 place-items-center rounded-[0.625rem] ${
              tone === 'critical' ? 'chip' : 'bg-primary-soft text-primary'
            }`}
          >
            {icon}
          </motion.span>
        </div>
        <p className="mt-2 text-2xl leading-none font-semibold tracking-tight">{value}</p>
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      </div>
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
      value: <AnimatedNumber value={active ?? 0} />,
      hint: active === 1 ? '1 patient being handled' : 'patients being handled',
      icon: (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 8v4m0 4h.01M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
        </svg>
      ),
    },
    {
      label: 'Critical',
      value: <AnimatedNumber value={critical} />,
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
      value: (
        <AnimatedNumber
          value={ambulancesOut}
          format={() => `${ambulancesOut}/${fleetTotal}`}
        />
      ),
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
      value: (
        <AnimatedNumber
          value={bedsFree}
          format={() => `${bedsFree}/${bedsTotal}`}
        />
      ),
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
