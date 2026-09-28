import { useEffect } from 'react';
import type { Incident } from '../types';
import { TONES, severityWord, toneForSeverity } from '../lib/status';
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!incident) return null;
  const tone = toneForSeverity(incident.severity);
  const factors = Object.entries(incident.impact_factors ?? {}).filter(
    ([, value]) => typeof value === 'number' || typeof value === 'string',
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="fade-in relative flex h-full w-full max-w-md flex-col border-l border-[var(--color-line)] bg-[var(--color-surface)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] p-5">
          <div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${TONES[tone].chip}`}>
              {severityWord(incident.severity)} · severity {incident.severity.toFixed(1)}
            </span>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">Case {incident.alert_id}</h2>
            <p className="text-sm text-[var(--color-muted)]">
              {hospitalName} · {incident.destination.replace(/_/g, ' ')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--color-line)] text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[var(--color-accent-soft)] p-3.5">
              <p className="text-[11px] font-medium tracking-wide text-[var(--color-muted)] uppercase">Team reaches crash</p>
              <p className="mt-1 text-xl font-semibold">{minutes(incident.eta_scene_seconds)}</p>
            </div>
            <div className="rounded-xl bg-[var(--color-accent-soft)] p-3.5">
              <p className="text-[11px] font-medium tracking-wide text-[var(--color-muted)] uppercase">Patient arrives</p>
              <p className="mt-1 text-xl font-semibold">{minutes(incident.eta_hospital_seconds)}</p>
            </div>
          </div>

          {factors.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                What the sensors found
              </h3>
              <dl className="mt-2.5 divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)]">
                {factors.map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                    <dt className="text-sm text-[var(--color-muted)]">
                      {FACTOR_LABELS[key] ?? key.replace(/_/g, ' ')}
                    </dt>
                    <dd className="text-sm font-semibold tabular-nums">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section>
            <h3 className="text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase">
              What has happened so far
            </h3>
            <ol className="mt-3 space-y-0">
              {(incident.events ?? []).map((event, i, all) => {
                const last = i === all.length - 1;
                return (
                  <li key={`${event.status}-${i}`} className="flex gap-3.5">
                    <div className="flex flex-col items-center">
                      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${TONES[tone].dot} ${last ? 'ring-4 ring-[var(--color-accent-soft)]' : ''}`} />
                      {!last && <span className="w-px flex-1 bg-[var(--color-line)]" />}
                    </div>
                    <div className="pb-5">
                      <p className="text-sm font-medium capitalize">
                        {event.status.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {event.created_at ? clock(event.created_at) : '—'}
                        {event.at_scene ? ' · at the crash site' : ''}
                      </p>
                      {event.note && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{event.note}</p>}
                    </div>
                  </li>
                );
              })}
              {(!incident.events || incident.events.length === 0) && (
                <li className="text-sm text-[var(--color-muted)]">No activity recorded yet.</li>
              )}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}
