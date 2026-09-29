import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Incident } from '../types';
import { severityWord, toneForSeverity } from '../lib/status';
import { clock, distance, minutes, todayTime } from '../lib/format';
import { copyText } from '../lib/clipboard';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="tnum text-right text-sm font-semibold">{value}</dd>
    </div>
  );
}

function List({ label, items }: { label: string; items: string[] }) {
  const clean = items.filter((item) => item && item.toLowerCase() !== 'none');
  if (clean.length === 0) return null;
  return (
    <section>
      <h3 className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">{label}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {clean.map((item) => (
          <li key={item} className="surface-2 rounded-full px-3 py-1 text-sm capitalize">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DetailSheet({ incident, onClose }: { incident: Incident | null; onClose: () => void }) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLElement | null>(null);
  const restore = useRef<HTMLElement | null>(null);
  const [copied, setCopied] = useState(false);

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
    setCopied(false);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      restore.current?.focus();
    };
  }, [incident, onClose]);

  const patient = incident?.patient;

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
            exit={
              reduce
                ? { opacity: 0, transition: { duration: 0.18 } }
                : { x: '100%', transition: { type: 'tween', duration: 0.28, ease: [0.22, 1, 0.36, 1] } }
            }
            transition={{ type: 'spring', stiffness: 320, damping: 36, mass: 0.9 }}
            className="relative flex h-full w-full max-w-[30rem] flex-col border-l border-line bg-surface/95 shadow-lift backdrop-blur-2xl outline-none"
          >
            <header className="flex items-start justify-between gap-4 border-b border-line p-5">
              <div className="min-w-0" data-tone={toneForSeverity(incident.severity)}>
                <span className="chip rounded-full px-2.5 py-1 text-xs font-semibold">
                  {severityWord(incident.severity)}
                </span>
                <h2 className="tnum mt-2 text-lg font-semibold tracking-tight">{incident.alert_id}</h2>
                <p className="text-sm text-muted capitalize">{incident.status.replace(/_/g, ' ')}</p>
              </div>
              <motion.button
                whileTap={reduce ? undefined : { scale: 0.92 }}
                onClick={onClose}
                aria-label="Close details"
                className="grid size-11 shrink-0 place-items-center rounded-xl border border-line text-muted hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </motion.button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              {incident.severity_summary && (
                <p className="surface-2 rounded-xl px-4 py-3 text-sm">{incident.severity_summary}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Team reaches crash', value: minutes(incident.eta_scene_seconds) },
                  { label: 'Patient arrives', value: minutes(incident.eta_hospital_seconds) },
                ].map((item) => (
                  <div key={item.label} className="surface-2 rounded-xl p-3.5">
                    <p className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">{item.label}</p>
                    <p className="tnum mt-1 text-xl font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>

              <section>
                <h3 className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">Where</h3>
                <p className="mt-2 text-sm">
                  {incident.location.label ?? `${incident.location.lat.toFixed(5)}, ${incident.location.lon.toFixed(5)}`}
                </p>
                <p className="tnum mt-0.5 text-xs text-muted">
                  {incident.location.lat.toFixed(5)}, {incident.location.lon.toFixed(5)}
                  {incident.distance_m != null && <> · {distance(incident.distance_m)} from your hospital</>}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={incident.location.directions_url} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    Directions
                  </a>
                  <a href={incident.location.maps_url} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    Google Maps
                  </a>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={async () => {
                      const ok = await copyText(incident.share_text);
                      setCopied(ok);
                    }}
                  >
                    {copied ? 'Copied' : 'Copy details'}
                  </button>
                </div>
              </section>

              <section>
                <h3 className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">Patient</h3>
                <dl className="mt-2.5 divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-line">
                  <Row label="Name" value={patient?.name ?? 'Unknown'} />
                  <Row label="Age" value={patient?.age != null ? patient.age : '—'} />
                  <Row label="Blood type" value={patient?.blood_type ?? '—'} />
                  <Row label="Sex" value={patient?.gender ? patient.gender : '—'} />
                  {patient?.notes && <Row label="Notes" value={patient.notes} />}
                </dl>
              </section>

              {patient && (
                <div className="space-y-5">
                  <List label="Ongoing conditions" items={patient.conditions} />
                  <List label="Medications" items={patient.medications} />
                  <List label="Allergies" items={patient.allergies} />
                </div>
              )}

              <section>
                <h3 className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">What has happened</h3>
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

              {incident.occurred_at && (
                <p className="text-xs text-muted">Crash happened {todayTime(incident.occurred_at)}</p>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
