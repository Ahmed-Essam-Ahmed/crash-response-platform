import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from './Button';
import type { Ambulance, Hospital } from '../types';

const STATUS_WORDS: Record<string, string> = {
  available: 'Ready',
  assigned: 'Out on a case',
  en_route: 'Driving',
  on_scene: 'At the crash',
  transporting: 'Carrying a patient',
  out_of_service: 'Out of service',
};

const STATUS_DOTS: Record<string, string> = {
  available: 'var(--sev-mild)',
  assigned: 'var(--primary)',
  en_route: 'var(--primary)',
  on_scene: 'var(--primary)',
  transporting: 'var(--primary)',
  out_of_service: 'var(--line-strong)',
};

export function ResourcePanel({
  hospital,
  ambulances,
  busy,
  canManage,
  onSave,
}: {
  hospital: Hospital;
  ambulances: Ambulance[];
  busy: boolean;
  canManage: boolean;
  onSave: (body: { beds_total?: number; ambulances_total?: number }) => Promise<void>;
}) {
  const reduce = useReducedMotion();
  const [beds, setBeds] = useState(hospital.beds_total);
  const [fleet, setFleet] = useState(hospital.ambulances_total);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!canManage) setOpen(false);
  }, [canManage]);

  useEffect(() => setBeds(hospital.beds_total), [hospital.beds_total]);
  useEffect(() => setFleet(hospital.ambulances_total), [hospital.ambulances_total]);

  const dirty = beds !== hospital.beds_total || fleet !== hospital.ambulances_total;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Your capacity</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-primary-ink hover:underline"
          >
            {open ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <div className="surface-2 flex items-center justify-between gap-3 rounded-xl px-3.5 py-3">
          <span className="text-sm">Ambulances</span>
          <span className="tnum text-sm font-semibold">
            {hospital.ambulances_available} ready / {hospital.ambulances_total}
          </span>
        </div>
        <div className="surface-2 flex items-center justify-between gap-3 rounded-xl px-3.5 py-3">
          <span className="text-sm">Trauma level</span>
          <span className="text-sm font-semibold">Level {hospital.trauma_level}</span>
        </div>
      </div>

      {open && (
        <motion.div
          initial={reduce ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 space-y-3 overflow-hidden border-t border-line pt-4"
        >
          <label className="block">
            <span className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
              Ambulances owned
            </span>
            <input
              type="number"
              min={0}
              value={fleet}
              onChange={(e) => setFleet(Math.max(0, Number(e.target.value)))}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm outline-none focus:border-[var(--primary)]"
            />
          </label>
          <label className="block">
            <span className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
              Beds
            </span>
            <input
              type="number"
              min={hospital.beds_occupied}
              value={beds}
              onChange={(e) => setBeds(Math.max(0, Number(e.target.value)))}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm outline-none focus:border-[var(--primary)]"
            />
            <span className="mt-1 block text-xs text-muted">
              {hospital.beds_occupied} in use right now, so this cannot go below {hospital.beds_occupied}.
            </span>
          </label>
          <Button
            disabled={!dirty || busy || beds < hospital.beds_occupied}
            className="w-full"
            onClick={() =>
              void onSave({
                beds_total: beds !== hospital.beds_total ? beds : undefined,
                ambulances_total: fleet !== hospital.ambulances_total ? fleet : undefined,
              })
            }
          >
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </motion.div>
      )}

      <h3 className="mt-5 text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
        Fleet status
      </h3>
      <ul className="mt-2.5 space-y-2">
        {ambulances.length === 0 && <li className="text-sm text-muted">No ambulances on record.</li>}
        {ambulances.map((amb) => (
          <li key={amb.ambulance_id} className="flex items-center gap-2.5 text-sm">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_DOTS[amb.status] ?? 'var(--line-strong)' }}
            />
            <span className="min-w-0 flex-1 truncate">{amb.label ?? amb.ambulance_id}</span>
            <span className="shrink-0 text-xs text-muted">
              {STATUS_WORDS[amb.status] ?? amb.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
