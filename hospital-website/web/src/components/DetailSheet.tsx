import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Incident } from '../types';
import { severityWord, toneForSeverity } from '../lib/status';
import { clock, minutes } from '../lib/format';

const FACTOR_LABELS: Record<string, string> = {
  peak_g: 'Hardest impact (g)',
  delta_v_mps: 'Speed lost (m/s)',
  speed_at_impact_mps: 'Speed on impact (m/s)',
  post_crash_inactive: 'Person not moving',
  impact_type: 'Type of impact',
};

export function DetailSheet({
  incident,
  hospitalName,
  onClose,
}: {
  incident: Incident | null;
  hospitalName: string;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLElement | null>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!incident) return;
    restore.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    panel.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      restore.current?.focus();
    };
  }, [incident, onClose]);

  return (
    <AnimatePresence>
      {incident && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-[oklch(0.15_0.02_264/0.35)] backdrop-blur-sm"
          />

          <motion.aside
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={`Case ${incident.alert_id}`}
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 36, mass: 0.9 }}
            className="relative flex h-full w-full max-w-[30rem] flex-col border-l border-line bg-surface shadow-lift outline-none"
          >
            <header className="flex items-start justify-between gap-4 border-b border-line p-5">
              <div className="min-w-0" data-tone={toneForSeverity(incident.severity)}>
                <span className="chip rounded-full px-2.5 py-1 text-xs font-semibold">
                  {severityWord(incident.severity)} · severity {incident.severity.toFixed(1)}
                </span>
                <h2 className="tnum mt-2 text-lg font-semibold tracking-tight">{incident.alert_id}</h2>
                <p className="text-sm text-muted">
                  {hospitalName} · {incident.destination.replace(/_/g, ' ')}
                </p>
              </div>
              <motion.button
                whileTap={reduce ? undefined : { scale: 0.92 }}
                onClick={onClose}
                aria-label="Close details"
                className="grid size-11 shrink-0 place-items-center rounded-xl border border-line text-muted hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </motion.button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Team reaches crash', value: minutes(incident.eta_scene_seconds) },
                  { label: 'Patient arrives', value: minutes(incident.eta_hospital_seconds) },
                ].map((item) => (
                  <div key={item.label} className="surface-2 rounded-xl p-3.5">
                    <p className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
                      {item.label}
                    </p>
                    <p className="tnum mt-1 text-xl font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>

              {incident.impact_factors && Object.keys(incident.impact_factors).length > 0 && (
                <section>
                  <h3 className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
                    What the sensors found
                  </h3>
                  <dl className="mt-2.5 divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-line">
                    {Object.entries(incident.impact_factors).map(([key, value]) => (
                      <div key={key} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                        <dt className="text-sm text-muted">{FACTOR_LABELS[key] ?? key.replace(/_/g, ' ')}</dt>
                        <dd className="tnum text-sm font-semibold">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              <section>
                <h3 className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
                  What has happened so far
                </h3>
                <ol className="mt-3">
                  {(incident.events ?? []).length === 0 && (
                    <li className="text-sm text-muted">No activity recorded yet.</li>
                  )}
                  {(incident.events ?? []).map((event, i, all) => {
                    const last = i === all.length - 1;
                    return (
                      <li key={`${event.status}-${i}`} className="flex gap-3.5">
                        <div className="flex flex-col items-center">
                          <span
                            className={`mt-1 size-2.5 shrink-0 rounded-full ${last ? 'ring-4 ring-primary-soft' : ''}`}
                            style={{ backgroundColor: 'var(--sev-mild)' }}
                          />
                          {!last && <span className="w-px flex-1 bg-[var(--line)]" />}
                        </div>
                        <div className="pb-5">
                          <p className="text-sm font-medium capitalize">{event.status.replace(/_/g, ' ')}</p>
                          <p className="tnum text-xs text-muted">
                            {event.created_at ? clock(event.created_at) : '—'}
                            {event.at_scene ? ' · at the crash site' : ''}
                          </p>
                          {event.note && <p className="mt-0.5 text-xs text-muted">{event.note}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
