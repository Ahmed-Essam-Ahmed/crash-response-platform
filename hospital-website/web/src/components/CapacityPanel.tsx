import { motion, useReducedMotion } from 'motion/react';
import { useHoverFx } from '../lib/useHoverFx';
import type { Hospital } from '../types';

function Bar({ used, capacity }: { used: number; capacity: number }) {
  const pct = capacity ? Math.round((used / capacity) * 100) : 0;
  const reduce = useReducedMotion();
  const color =
    pct >= 75 ? 'var(--sev-critical)' : pct >= 40 ? 'var(--sev-moderate)' : 'var(--sev-mild)';

  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${Math.max(pct, used > 0 ? 5 : 0)}%` }}
        transition={{ type: 'spring', stiffness: 140, damping: 22 }}
      />
    </div>
  );
}

export function CapacityPanel({ hospitals, loading }: { hospitals: Hospital[]; loading: boolean }) {
  const { node, onPointerMove, onPointerLeave } = useHoverFx();
  const reduce = useReducedMotion();

  return (
    <div
      ref={node}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="card fx fx-border p-5"
    >
      <h2 className="text-sm font-semibold tracking-tight">Hospital capacity</h2>

      {loading ? (
        <div className="mt-4 space-y-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-3.5 w-32 rounded-lg" />
              <div className="skeleton h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {hospitals.map((hospital) => (
            <motion.li
              key={hospital.hospital_id}
              whileHover={reduce ? undefined : { x: 4 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium">{hospital.name}</p>
                <p className="tnum shrink-0 text-xs text-muted">{hospital.free_beds} free</p>
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                <Bar used={hospital.current_load} capacity={hospital.capacity} />
                <span className="tnum w-12 shrink-0 text-right text-xs text-muted">
                  {hospital.current_load}/{hospital.capacity}
                </span>
              </div>
              <p className="mt-1.5 text-2xs text-muted">Trauma level {hospital.trauma_level}</p>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
