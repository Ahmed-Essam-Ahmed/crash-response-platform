import { forwardRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { plainFor, severityWord, toneForSeverity } from '../lib/status';
import { ago, clockTime, distance, minutes } from '../lib/format';
import { MechanismLine } from './CaseFacts';
import { useHoverFx } from '../lib/useHoverFx';
import { Stepper } from './Stepper';
import { Button } from './Button';
import type { Incident } from '../types';

const TONE_VAR: Record<string, string> = {
  critical: 'var(--sev-critical)',
  serious: 'var(--sev-serious)',
  moderate: 'var(--sev-moderate)',
  mild: 'var(--sev-mild)',
};

function patientLine(incident: Incident) {
  const patient = incident.patient;
  if (!patient) return 'Patient details unavailable';
  const parts = [patient.name ?? 'Unnamed patient'];
  if (patient.age != null) parts.push(`${patient.age}`);
  if (patient.blood_type) parts.push(patient.blood_type);
  return parts.join(' · ');
}

export const IncidentCard = forwardRef<
  HTMLElement,
  {
    incident: Incident;
    busy: boolean;
    canAct: boolean;
    onAdvance: () => void;
    onCancel: () => void;
    onOpen: () => void;
  }
>(function IncidentCard({ incident, busy, canAct, onAdvance, onCancel, onOpen }, ref) {
  const reduce = useReducedMotion();
  const { node, onPointerMove, onPointerLeave } = useHoverFx();
  const tone = toneForSeverity(incident.severity);
  const { headline, action } = plainFor(incident.status);
  const done = incident.status === 'closed' || incident.status === 'cancelled';
  const rail = TONE_VAR[tone];
  const { location } = incident;

  return (
    <motion.article
      ref={ref}
      layout
      data-tone={tone}
      initial={reduce ? false : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: done ? 0.68 : 1, y: 0, scale: 1 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.95, transition: { duration: 0.22 } }}
      transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.8 }}
      className="card relative overflow-hidden"
    >
      <div
        ref={node}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="fx @container flex"
      >
        <span className="w-1 shrink-0 self-stretch" style={{ backgroundColor: rail }} aria-hidden />

        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip rounded-full px-2.5 py-1 text-xs font-semibold">
                  {severityWord(incident.severity)}
                  <span className="tnum ml-1.5 opacity-70">{incident.severity.toFixed(1)}/10</span>
                </span>
                <span className="tnum text-xs text-muted">
                  {ago(incident.created_at ?? incident.updated_at ?? new Date().toISOString())}
                </span>
                {incident.occurred_at && (
                  <span className="tnum text-xs text-muted">crash at {clockTime(incident.occurred_at)}</span>
                )}
              </div>

              <h3 className="mt-2 text-lg leading-snug font-semibold tracking-tight @xl:text-xl">
                {headline}
              </h3>
              <p className="mt-1 text-sm font-medium text-ink-soft">{patientLine(incident)}</p>
              <MechanismLine mechanism={incident.mechanism} />

              <p className="mt-1 text-sm text-muted">
                {location.label ?? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`}
                {incident.status === 'en_route_to_scene' && incident.eta_scene_seconds != null && (
                  <> · reaches the crash in {minutes(incident.eta_scene_seconds)}</>
                )}
                {incident.status === 'en_route_to_hospital' && incident.eta_hospital_seconds != null && (
                  <> · arrives here in {minutes(incident.eta_hospital_seconds)}</>
                )}
                {incident.assignment.ambulance_ids.length > 0 && (
                  <> · {incident.assignment.ambulance_ids.length} unit{incident.assignment.ambulance_ids.length > 1 ? 's' : ''}</>
                )}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <a
                  href={location.maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-primary-ink underline-offset-2 hover:underline"
                >
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  Open in Google Maps
                </a>
                {incident.distance_m != null && (
                  <span className="tnum text-xs text-muted">{distance(incident.distance_m)} from you</span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {action && !done && canAct && (
                <Button variant="primary" onClick={onAdvance} disabled={busy}>
                  {busy ? 'Working…' : action}
                </Button>
              )}
              <Button variant="ghost" onClick={onOpen}>
                Details
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <Stepper status={incident.status} tone={rail} />
          </div>

          {!done && canAct && (
            <motion.button
              whileHover={reduce ? undefined : { x: 3 }}
              whileTap={reduce ? undefined : { scale: 0.96 }}
              onClick={onCancel}
              disabled={busy}
              className="press mt-1 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition-colors hover:bg-[color-mix(in_oklab,var(--sev-critical)_10%,transparent)] hover:text-[var(--sev-critical)] disabled:opacity-50"
            >
              Cancel this case
              <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M5 12h14" />
              </svg>
            </motion.button>
          )}
        </div>
      </div>
    </motion.article>
  );
});
