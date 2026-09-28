import { TONES, plainFor, severityWord, toneForSeverity } from '../lib/status';
import { ago, minutes } from '../lib/format';
import { Stepper } from './Stepper';
import type { Incident } from '../types';

export function IncidentCard({
  incident,
  hospitalName,
  busy,
  onAdvance,
  onCancel,
  onOpen,
}: {
  incident: Incident;
  hospitalName: string;
  busy: boolean;
  onAdvance: () => void;
  onCancel: () => void;
  onOpen: () => void;
}) {
  const tone = toneForSeverity(incident.severity);
  const palette = TONES[tone];
  const { headline, action } = plainFor(incident.status);
  const done = incident.status === 'closed' || incident.status === 'cancelled';
  const bar = TONES[tone].dot;

  return (
    <article
      className={`card shadow-soft overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg ${
        done ? 'opacity-70' : ''
      }`}
    >
      <div className="flex">
        <span className={`w-1.5 shrink-0 ${bar}`} aria-hidden />

        <div className="flex-1 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${palette.chip}`}>
                  {severityWord(incident.severity)}
                </span>
                <span className="text-xs text-[var(--color-muted)]">
                  {ago(incident.created_at ?? incident.updated_at ?? new Date().toISOString())}
                </span>
              </div>
              <h3 className="mt-2 text-lg leading-snug font-semibold tracking-tight">{headline}</h3>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {hospitalName}
                {incident.assignment.ambulance_ids.length > 0 && (
                  <> · {incident.assignment.ambulance_ids.length === 1
                    ? incident.assignment.ambulance_ids[0]
                    : `${incident.assignment.ambulance_ids.length} ambulances`}</>
                )}
                {incident.status === 'en_route_to_scene' && incident.eta_scene_seconds != null && (
                  <> · arrives in {minutes(incident.eta_scene_seconds)}</>
                )}
                {incident.status === 'en_route_to_hospital' && incident.eta_hospital_seconds != null && (
                  <> · patient arrives in {minutes(incident.eta_hospital_seconds)}</>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {action && !done && (
                <button
                  onClick={onAdvance}
                  disabled={busy}
                  className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
                >
                  {busy ? 'Working…' : action}
                </button>
              )}
              <button
                onClick={onOpen}
                className="rounded-xl border border-[var(--color-line)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)] active:scale-[0.97]"
              >
                Details
              </button>
            </div>
          </div>

          <div className="mt-4">
            <Stepper status={incident.status} tone={bar} />
          </div>

          {!done && (
            <button
              onClick={onCancel}
              disabled={busy}
              className="mt-3 inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-medium text-[var(--color-muted)] transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
            >
              Cancel this call
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
